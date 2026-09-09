'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/server/admin';
import { adminClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/server/mail';
import { sponsorshipDecisionEmail } from '@/lib/email-policy';
import { placementById, type CreativeEdit } from '@/lib/advertising';
import { reconcileCategoryBilling } from '@/lib/server/sponsorships';

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
 *  makes a paid placement render; the sponsor is emailed the decision. When
 *  a live sponsor has edits waiting in `pending`, the same buttons apply or
 *  drop those edits and leave the approval itself untouched. */
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
  const pending = (order.pending ?? null) as CreativeEdit | null;
  const changes = Boolean(pending) && order.approval === 'approved';
  const now = new Date().toISOString();
  const review = {
    reviewed_at: now,
    reviewed_by: admin.email,
    review_note: note,
    updated_at: now,
  };
  const patch =
    changes && decision === 'approved'
      ? {
          ...review,
          tagline: pending!.tagline,
          description: pending!.description,
          cta: pending!.cta,
          categories: pending!.categories.join(','),
          pending: null,
        }
      : changes && decision === 'rejected'
        ? { ...review, pending: null }
        : { ...review, approval: decision };
  const update = await db
    .from('ad_orders')
    .update(patch)
    .eq('stripe_session_id', id);
  if (update.error) throw update.error;
  await log(
    admin.email,
    'sponsor.' + (changes ? 'changes-' : '') + decision,
    id,
    note,
  );
  if (decision === 'approved' || (changes && decision === 'rejected')) {
    // Category changes were charged when the sponsor saved them. Approval
    // confirms the billing matches the live categories; rejecting pending
    // changes reverts the extra-category line to the categories that stay
    // live, with a prorated credit.
    const live = {
      stripe_subscription_id: String(order.stripe_subscription_id ?? ''),
      placement: String(order.placement),
      categories:
        changes && decision === 'approved'
          ? pending!.categories.join(',')
          : String(order.categories ?? ''),
    };
    try {
      const plan = await reconcileCategoryBilling(live);
      if (plan.action !== 'none' && plan.action !== 'skipped')
        await log(
          admin.email,
          'sponsor.billing.' + plan.action,
          id,
          'extra categories: ' + plan.quantity,
        );
    } catch (err) {
      await log(
        admin.email,
        'sponsor.billing.failed',
        id,
        (err as Error).message.slice(0, 300),
      );
    }
  }
  const notify =
    order.customer_email &&
    decision !== 'pending' &&
    (changes || order.approval !== decision);
  if (notify)
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
        changes,
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

/** Demo material in the admin's own account: a real published listing, a
 *  draft and a test-mode sponsorship, so the dashboard can be reviewed. */
export async function seedDemo(form: FormData) {
  const admin = await requireAdmin('/admin');
  const mode = text(form, 'mode', 10);
  let notice: string;
  try {
    if (mode === 'remove') {
      const { removeDemoData } = await import('@/lib/server/demo');
      const removed = await removeDemoData(admin);
      notice = removed.length
        ? 'Removed: ' + removed.join(', ') + '.'
        : 'Nothing to remove.';
      await log(admin.email, 'demo.remove', admin.id, notice);
    } else {
      const { createDemoData } = await import('@/lib/server/demo');
      const result = await createDemoData(admin);
      notice = `Listing: ${result.published}. Draft: ${result.draft}. Sponsorship: ${result.sponsorship}.`;
      await log(admin.email, 'demo.create', admin.id, notice);
    }
  } catch (err) {
    notice = 'Demo data failed: ' + (err as Error).message.slice(0, 300);
    await log(admin.email, 'demo.failed', admin.id, notice);
  }
  refresh();
  revalidatePath('/dashboard');
  redirect('/admin?notice=' + encodeURIComponent(notice));
}

/** Top bar rotation interval, in seconds. */
export async function saveBarSettings(form: FormData) {
  const admin = await requireAdmin('/admin/sponsors');
  const seconds = Math.round(Number(text(form, 'seconds', 6)));
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 600) return;
  const { error } = await adminClient()
    .from('site_settings')
    .upsert(
      {
        key: 'sponsor_bar',
        value: { intervalSeconds: seconds },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  if (error) throw error;
  await log(admin.email, 'settings.sponsor_bar', 'interval', seconds + 's');
  refresh();
}

/** Hide or show a sponsorship everywhere without touching its subscription. */
export async function toggleSponsorHidden(form: FormData) {
  const admin = await requireAdmin('/admin/sponsors');
  const id = text(form, 'session', 200);
  const hidden = text(form, 'hidden', 5) === 'true';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return;
  const { error } = await adminClient()
    .from('ad_orders')
    .update({ hidden, updated_at: new Date().toISOString() })
    .eq('stripe_session_id', id);
  if (error) throw error;
  await log(admin.email, hidden ? 'sponsor.hide' : 'sponsor.show', id);
  refresh();
}

/** Move a sponsorship up or down in the manual display order. Positions
 *  are rewritten 1..n over every approved, active order so gaps never
 *  matter. */
export async function moveSponsor(form: FormData) {
  const admin = await requireAdmin('/admin/sponsors');
  const id = text(form, 'session', 200);
  const direction = text(form, 'direction', 5);
  if (!/^cs_[A-Za-z0-9_]+$/.test(id) || !['up', 'down'].includes(direction))
    return;
  const db = adminClient();
  const { data, error } = await db
    .from('ad_orders')
    .select('stripe_session_id,position,created_at')
    .eq('approval', 'approved')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as {
    stripe_session_id: string;
    position: number | null;
    created_at: string;
  }[];
  rows.sort(
    (a, b) =>
      (a.position ?? Number.MAX_SAFE_INTEGER) -
        (b.position ?? Number.MAX_SAFE_INTEGER) ||
      b.created_at.localeCompare(a.created_at),
  );
  const index = rows.findIndex((r) => r.stripe_session_id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  for (const [i, row] of rows.entries())
    await db
      .from('ad_orders')
      .update({ position: i + 1 })
      .eq('stripe_session_id', row.stripe_session_id);
  await log(admin.email, 'sponsor.move-' + direction, id);
  refresh();
}
