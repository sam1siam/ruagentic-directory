import { adminClient } from '../supabase/server';
import { confirmationEmail, retryDecision } from '../email-policy';
export async function deliverEmails() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return { sent: 0, unconfigured: true };
  const db = adminClient();
  const { data: jobs, error } = await db.rpc('claim_email_jobs', {
    p_limit: 3,
  });
  if (error) throw error;
  let sent = 0;
  for (const job of jobs ?? []) {
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
      sent++;
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
    }
  }
  return { sent, processed: jobs?.length ?? 0 };
}
