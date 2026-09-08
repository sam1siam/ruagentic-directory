import type Stripe from 'stripe';
import { adminClient } from '../supabase/server';
import { isAdMetadata, tierById } from '../advertising';
/** Records a completed sponsorship checkout. Idempotent on the session id. */
export async function recordAdOrder(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!isAdMetadata(metadata) || !tierById(metadata.tier)) return false;
  if (session.mode !== 'subscription' || session.status !== 'complete')
    return false;
  const subscription =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription?.id ?? null);
  const customer =
    typeof session.customer === 'string'
      ? session.customer
      : (session.customer?.id ?? null);
  const { error } = await adminClient()
    .from('ad_orders')
    .upsert(
      {
        stripe_session_id: session.id,
        stripe_subscription_id: subscription,
        stripe_customer_id: customer,
        customer_email:
          session.customer_details?.email ?? session.customer_email ?? null,
        tier: metadata.tier,
        product: metadata.product,
        tagline: metadata.tagline,
        url: metadata.url,
        status: session.payment_status === 'paid' ? 'active' : 'incomplete',
        livemode: session.livemode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_session_id' },
    );
  if (error) throw error;
  return true;
}
/** Mirrors the subscription lifecycle so lapsed sponsors stop showing. */
export async function syncAdSubscription(subscription: Stripe.Subscription) {
  if (!isAdMetadata(subscription.metadata)) return false;
  const status =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? 'active'
      : subscription.status === 'past_due' || subscription.status === 'unpaid'
        ? 'past_due'
        : subscription.status === 'canceled' ||
            subscription.status === 'incomplete_expired'
          ? 'canceled'
          : 'incomplete';
  const { error } = await adminClient()
    .from('ad_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id);
  if (error) throw error;
  return true;
}
