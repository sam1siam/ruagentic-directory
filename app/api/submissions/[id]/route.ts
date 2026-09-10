import { after } from 'next/server';
import { rateLimit, respond, sameOrigin, signedIn } from '@/lib/server/http';
import { ownedSubmission, databaseError } from '@/lib/server/submissions';
import { adminClient } from '@/lib/supabase/server';
import { fulfill } from '@/lib/server/payments';
import { deliverEmails } from '@/lib/server/email';
import { duplicatesFor } from '@/lib/server/duplicates';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    const user = await signedIn(),
      { id } = await params;
    let submission = await ownedSubmission(user.id, id);
    const db = adminClient();
    const { data: checkouts, error } = await db
      .from('checkout_attempts')
      .select('id,state,stripe_session_id,revision,created_at')
      .eq('submission_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const open = checkouts?.find((c) => c.state === 'open');
    // The webhook is authoritative; reconcile on load only within a per-user budget.
    const reconcile =
      open?.stripe_session_id &&
      (await rateLimit('reconcile:' + user.id, 30).then(
        () => true,
        () => false,
      ));
    if (open?.stripe_session_id && reconcile) {
      try {
        await fulfill(
          open.stripe_session_id,
          'reconcile:' + open.stripe_session_id,
          'checkout.reconcile',
        );
        submission = await ownedSubmission(user.id, id);
        after(() => deliverEmails().catch(() => {}));
      } catch {
        /* Webhook will retry; never infer payment from a redirect. */
      }
    }
    const { data: audits } = await db
      .from('audit_runs')
      .select('id,eligible,checked_at,report,revision')
      .eq('submission_id', id)
      .eq('revision', submission.revision)
      .order('checked_at', { ascending: false })
      .limit(1);
    const { data: currentPayments } = await db
      .from('checkout_attempts')
      .select('id,state,revision')
      .eq('submission_id', id)
      .order('created_at', { ascending: false });
    const { data: publication } = await db
      .from('publication_events')
      .select('revision')
      .eq('submission_id', id)
      .eq('revision', submission.revision)
      .maybeSingle();
    return {
      submission,
      currentRevisionPublished: Boolean(publication),
      audit: audits?.[0] ?? null,
      payments: currentPayments ?? [],
      duplicates: await duplicatesFor(submission.payload, submission.slug),
    };
  });
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn(),
      { id } = await params;
    await ownedSubmission(user.id, id);
    const { error } = await adminClient().rpc('withdraw_submission', {
      p_owner: user.id,
      p_id: id,
    });
    if (error) databaseError(error);
    return { withdrawn: true };
  });
}
