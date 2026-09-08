import { adminClient } from '../supabase/server';
import { confirmationEmail, retryDecision } from '../email-policy';
type Job = {
  id: string;
  event_id: string;
  recipient: string;
  payload: { name: string; slug: string; method: string };
  attempts: number;
  first_attempt_at: string;
  lease_token: string;
  provider_request: Record<string, unknown> | null;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Drain the outbox: claim batches until nothing is due, waiting inside the
 *  time budget for the first short retry so a transient provider error is
 *  retried in the same invocation. Later retries belong to the cron. */
export async function deliverEmails(budgetMs = 50000) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return { sent: 0, processed: 0, unconfigured: true };
  const db = adminClient();
  const deadline = Date.now() + budgetMs;
  let sent = 0,
    processed = 0;
  for (;;) {
    const { data, error } = await db.rpc('claim_email_jobs', { p_limit: 10 });
    if (error) throw error;
    const jobs = (data ?? []) as Job[];
    if (!jobs.length) {
      const { data: next } = await db
        .from('email_outbox')
        .select('next_attempt_at')
        .in('state', ['pending', 'failed'])
        .lt('attempts', 8)
        .order('next_attempt_at')
        .limit(1)
        .maybeSingle();
      const wait = next ? Date.parse(next.next_attempt_at) - Date.now() : NaN;
      if (!Number.isFinite(wait) || Date.now() + Math.max(wait, 0) > deadline)
        break;
      await sleep(Math.max(wait, 250));
      continue;
    }
    for (const job of jobs) {
      processed++;
      if (await deliver(db, job)) sent++;
    }
    if (Date.now() > deadline) break;
  }
  return { sent, processed };
}
async function deliver(db: ReturnType<typeof adminClient>, job: Job) {
  try {
    const providerRequest = job.provider_request ?? {
      from: process.env.RESEND_FROM,
      ...(process.env.SUPPORT_EMAIL
        ? { reply_to: process.env.SUPPORT_EMAIL }
        : {}),
      to: job.recipient,
      ...confirmationEmail(job.payload),
    };
    if (!job.provider_request) {
      const stored = await db
        .from('email_outbox')
        .update({ provider_request: providerRequest })
        .eq('id', job.id)
        .eq('lease_token', job.lease_token)
        .select('id')
        .single();
      if (stored.error) throw stored.error;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'listing-publication/' + job.event_id,
      },
      body: JSON.stringify(
        Object.fromEntries(
          Object.entries(providerRequest).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        ),
      ),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error('email_provider_error');
    const saved = await db
      .from('email_outbox')
      .update({
        state: 'sent',
        provider_id: result.id,
        lease_until: null,
        last_error: null,
      })
      .eq('id', job.id)
      .eq('lease_token', job.lease_token);
    if (saved.error) throw saved.error;
    return true;
  } catch {
    const retry = retryDecision(job.attempts, job.first_attempt_at);
    await db
      .from('email_outbox')
      .update({
        state: retry.state,
        next_attempt_at: retry.next ?? new Date().toISOString(),
        lease_until: null,
        last_error:
          'Delivery not confirmed; retry uses the same provider idempotency key.',
      })
      .eq('id', job.id)
      .eq('lease_token', job.lease_token);
    return false;
  }
}
