import type Stripe from 'stripe';
import { adminClient } from '../supabase/server';
import {
  isAdMetadata,
  parseCategories,
  placementById,
  quote,
  sponsorSlug,
} from '../advertising';
import { sponsorshipEmail, sponsorshipNotice } from '../email-policy';
import { sendMail } from './mail';
/** Records a completed sponsorship checkout as pending review. Idempotent on
 *  the session id; the sponsor and the site owner are emailed the first time
 *  a session is recorded (the provider idempotency key covers a
 *  webhook/thank-you race). */
export async function recordAdOrder(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!isAdMetadata(metadata) || !placementById(metadata.placement))
    return false;
  if (session.mode !== 'subscription' || session.status !== 'complete')
    return false;
  const db = adminClient();
  const existing = await db
    .from('ad_orders')
    .select('stripe_session_id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const subscription =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription?.id ?? null);
  const customer =
    typeof session.customer === 'string'
      ? session.customer
      : (session.customer?.id ?? null);
  const email =
    session.customer_details?.email ?? session.customer_email ?? null;
  const categories = parseCategories(metadata.categories);
  const slug = sponsorSlug(metadata.product, session.id);
  const uuid = /^[0-9a-f-]{36}$/i;
  const owner = uuid.test(metadata.owner ?? '')
    ? metadata.owner
    : uuid.test(session.client_reference_id ?? '')
      ? session.client_reference_id
      : null;
  const paid = session.payment_status === 'paid';
  const { error } = await db.from('ad_orders').upsert(
    {
      stripe_session_id: session.id,
      stripe_subscription_id: subscription,
      stripe_customer_id: customer,
      customer_email: email,
      owner_id: owner,
      slug,
      placement: metadata.placement,
      product: metadata.product,
      tagline: metadata.tagline,
      description: metadata.description ?? '',
      cta: metadata.cta ?? '',
      categories: categories.join(','),
      url: metadata.url,
      status: paid ? 'active' : 'incomplete',
      livemode: session.livemode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_session_id' },
  );
  if (error) throw error;
  if (!existing.data && paid)
    await notifySponsorship({
      sessionId: session.id,
      email,
      product: metadata.product,
      placement: metadata.placement,
      categories,
      slug,
      livemode: session.livemode,
    }).catch(() => {});
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
/** "Received, under review" to the sponsor and a notice to the site owner. */
async function notifySponsorship(order: {
  sessionId: string;
  email: string | null;
  product: string;
  placement: string;
  categories: string[];
  slug: string;
  livemode: boolean;
}) {
  const placement = placementById(order.placement)!;
  const total = quote(placement.id, order.categories);
  const details = {
    product: order.product,
    placement: placement.name,
    categories: order.categories,
    total: total.display,
    slug: order.slug,
    livemode: order.livemode,
  };
  if (order.email)
    await sendMail(
      order.email,
      sponsorshipEmail(details),
      'sponsorship/' + order.sessionId + '/' + order.email.toLowerCase(),
    );
  if (process.env.ADS_NOTIFY_EMAIL)
    await sendMail(
      process.env.ADS_NOTIFY_EMAIL,
      sponsorshipNotice({ ...details, email: order.email }),
      'sponsorship/' + order.sessionId + '/owner',
    );
}
