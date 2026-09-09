import 'server-only';
import type Stripe from 'stripe';
import { adminClient } from '../supabase/server';
import { stripe } from './payments';
import { HttpError } from './http';
import {
  categoryItemPlan,
  parseCategories,
  quote,
  type CreativeEdit,
  type PlacementId,
} from '../advertising';
import type { AdOrder } from './admin';

export type OwnedOrder = AdOrder & {
  owner_id: string | null;
  pending: CreativeEdit | null;
};
/** Orders bought by this account. Orders paid before accounts were required
 *  are claimed by the confirmed email that paid for them. */
export async function ownedOrders(user: {
  id: string;
  email: string | null;
  confirmed: boolean;
}): Promise<OwnedOrder[]> {
  const db = adminClient();
  if (user.email && user.confirmed) {
    const claim = await db
      .from('ad_orders')
      .update({ owner_id: user.id, updated_at: new Date().toISOString() })
      .is('owner_id', null)
      .ilike('customer_email', user.email);
    if (claim.error) throw claim.error;
  }
  const { data, error } = await db
    .from('ad_orders')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as OwnedOrder[];
}
export async function ownedOrder(userId: string, sessionId: string) {
  const { data, error } = await adminClient()
    .from('ad_orders')
    .select('*')
    .eq('stripe_session_id', sessionId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'That sponsorship was not found.');
  return data as OwnedOrder;
}

export type SubscriptionFacts = {
  status: string;
  cancelAtPeriodEnd: boolean;
  renewsAt: string | null;
  categoryQuantity: number | null;
};
/** Live billing facts from Stripe; null when the subscription cannot be read. */
export async function subscriptionFacts(
  order: Pick<OwnedOrder, 'stripe_subscription_id'>,
): Promise<SubscriptionFacts | null> {
  if (!order.stripe_subscription_id) return null;
  try {
    const sub = await stripe().subscriptions.retrieve(
      order.stripe_subscription_id,
    );
    const first = sub.items.data[0];
    const extra = sub.items.data.find(
      (i) => i.price.id === process.env.STRIPE_AD_PRICE_CATEGORY,
    );
    return {
      status: sub.status,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      renewsAt: first
        ? new Date(first.current_period_end * 1000).toISOString()
        : null,
      categoryQuantity: extra ? (extra.quantity ?? 1) : null,
    };
  } catch {
    return null;
  }
}
/** Stripe's Customer Portal: update the card, see invoices, cancel. */
export async function portalUrl(order: OwnedOrder, returnUrl: string) {
  if (!order.stripe_customer_id)
    throw new HttpError(
      409,
      'Billing for this order is not linked to a customer yet.',
    );
  const session = await stripe().billingPortal.sessions.create({
    customer: order.stripe_customer_id,
    return_url: returnUrl,
  });
  return session.url;
}
/** Makes the subscription's "extra category" line match the order's
 *  categories, with prorations. Runs when a reviewer approves. */
export async function reconcileCategoryBilling(
  order: Pick<
    OwnedOrder,
    'stripe_subscription_id' | 'categories' | 'placement'
  >,
) {
  const price = process.env.STRIPE_AD_PRICE_CATEGORY;
  if (!order.stripe_subscription_id || !price)
    return { action: 'skipped' as const };
  const categories = parseCategories(order.categories);
  if (order.placement === 'bar') return { action: 'skipped' as const };
  const service = stripe();
  const sub = await service.subscriptions.retrieve(
    order.stripe_subscription_id,
  );
  const item = sub.items.data.find((i) => i.price.id === price);
  const plan = categoryItemPlan(item ? (item.quantity ?? 1) : null, categories);
  const proration: Stripe.SubscriptionItemUpdateParams.ProrationBehavior =
    'create_prorations';
  if (plan.action === 'create')
    await service.subscriptionItems.create({
      subscription: sub.id,
      price,
      quantity: plan.quantity,
      proration_behavior: proration,
    });
  else if (plan.action === 'update' && item)
    await service.subscriptionItems.update(item.id, {
      quantity: plan.quantity,
      proration_behavior: proration,
    });
  else if (plan.action === 'delete' && item)
    await service.subscriptionItems.del(item.id, {
      proration_behavior: proration,
    });
  return plan;
}
/** Saves a sponsor's edit. Approved orders keep their live creative until a
 *  reviewer applies the pending version; orders still in review are updated
 *  in place. Billing follows approval, never the edit itself. */
export async function saveCreative(order: OwnedOrder, edit: CreativeEdit) {
  const db = adminClient();
  const now = new Date().toISOString();
  const patch =
    order.approval === 'approved'
      ? { pending: edit, updated_at: now }
      : {
          tagline: edit.tagline,
          description: edit.description,
          cta: edit.cta,
          categories: edit.categories.join(','),
          pending: null,
          approval: 'pending',
          updated_at: now,
        };
  const { error } = await db
    .from('ad_orders')
    .update(patch)
    .eq('stripe_session_id', order.stripe_session_id);
  if (error) throw error;
  return order.approval === 'approved' ? 'pending-review' : 'updated';
}
export const orderMonthly = (
  order: Pick<OwnedOrder, 'placement' | 'categories'>,
) => quote(order.placement as PlacementId, parseCategories(order.categories));
