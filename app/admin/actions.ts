'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin';
import { adminClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/server/mail';
import { sponsorshipDecisionEmail } from '@/lib/email-policy';
import { placementById } from '@/lib/advertising';

const text = (form: FormData, key: string, max = 500) => {
  const value = form.get(key);
  return (typeof value === 'string' ? value : '').trim().slice(0, max);
};
async function log(actor: string, action: string, target: string, note = '') {
  await adminClient()
    .from('admin_actions')
    .insert({ actor, action, target, note });
}
function refresh() {
  for (const path of [
    '/admin',
    '/admin/sponsors',
    '/admin/submissions',
    '/admin/reports',
    '/admin/email',
  ])
    revalidatePath(path);
}

/** Approve, reject or return a sponsorship to the queue. Approval is what
 *  makes a paid placement render; the sponsor is emailed the decision. */
export async function reviewSponsor(form: FormData) {
  const admin = await requireAdmin('/admin/sponsors');
  const id = text(form, 'session', 200);
  const decision = text(form, 'decision', 20);
  const note = text(form, 'note');
  if (
    !/^cs_[A-Za-z0-9_]+$/.test(id) ||
    !['approved', 'rejected', 'pending'].includes(decision)
  )
    return;
  const db = adminClient();
  const { data: order, error } = await db
    .from('ad_orders')
    .select('*')
    .eq('stripe_session_id', id)
    .maybeSingle();
  if (error || !order) return;
  const update = await db
    .from('ad_orders')
    .update({
      approval: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.email,
      review_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', id);
  if (update.error) throw update.error;
  await log(admin.email, 'sponsor.' + decision, id, note);
  if (
    order.customer_email &&
    decision !== 'pending' &&
    order.approval !== decision
  )
    await sendMail(
      String(order.customer_email),
      sponsorshipDecisionEmail({
        decision: decision as 'approved' | 'rejected',
        product: String(order.product),
        placement:
          placementById(String(order.placement))?.name ??
          String(order.placement),
        slug: String(order.slug),
        note,
      }),
      'sponsorship-' + decision + '/' + id + '/' + Date.now(),
    ).catch(() => {});
  refresh();
}

/** Close a listing report, optionally hiding the listing it describes. */
export async function resolveReport(form: FormData) {
  const admin = await requireAdmin('/admin/reports');
  const id = text(form, 'report', 80);
  const state = text(form, 'state', 20);
  const resolution = text(form, 'resolution');
  if (
    !/^[0-9a-f-]{36}$/.test(id) ||
    !['resolved', 'dismissed', 'open'].includes(state)
  )
    return;
  const db = adminClient();
  const { error } = await db
    .from('listing_reports')
    .update({
      state,
      resolution,
      resolved_at: state === 'open' ? null : new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
  await log(admin.email, 'report.' + state, id, resolution);
  refresh();
}

/** Suspend a listing (hidden and locked for its owner) or restore it. */
export async function setListingState(form: FormData) {
  const admin = await requireAdmin('/admin/submissions');
  const id = text(form, 'submission', 80);
  const action = text(form, 'action', 20);
  const note = text(form, 'note');
  if (!/^[0-9a-f-]{36}$/.test(id) || !['suspend', 'restore'].includes(action))
    return;
  const db = adminClient();
  const { data: sub, error } = await db
    .from('submissions')
    .select('id,state,slug')
    .eq('id', id)
    .maybeSingle();
  if (error || !sub) return;
  if (action === 'suspend') {
    await db
      .from('submissions')
      .update({ state: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', id);
    await db
      .from('directory_entries')
      .update({ visible: false, updated_at: new Date().toISOString() })
      .eq('submission_id', id);
  } else {
    const { data: entry } = await db
      .from('directory_entries')
      .select('slug')
      .eq('submission_id', id)
      .maybeSingle();
    await db
      .from('submissions')
      .update({
        state: entry ? 'published' : 'editing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (entry)
      await db
        .from('directory_entries')
        .update({ visible: true, updated_at: new Date().toISOString() })
        .eq('submission_id', id);
  }
  await log(admin.email, 'listing.' + action, id, note);
  refresh();
}

/** Put a failed confirmation email back in the queue. */
export async function retryEmail(form: FormData) {
  const admin = await requireAdmin('/admin/email');
  const id = text(form, 'email', 80);
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const db = adminClient();
  const { error } = await db
    .from('email_outbox')
    .update({
      state: 'pending',
      next_attempt_at: new Date().toISOString(),
      lease_until: null,
      last_error: null,
    })
    .eq('id', id)
    .in('state', ['failed', 'uncertain']);
  if (error) throw error;
  await log(admin.email, 'email.retry', id);
  refresh();
}
