import { after } from 'next/server';
import Stripe from 'stripe';
import { stripe, fulfill } from '@/lib/server/payments';
import { adminClient } from '@/lib/supabase/server';
import { deliverEmails } from '@/lib/server/email';
import { boundedBody, BodyLimitError } from '@/lib/bounded-body';
import {
  isDirectoryMetadata,
  paymentIntentId,
  stripeKeyIsLive,
} from '@/lib/payment-policy';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    return new Response('Webhook unavailable', { status: 503 });
  let event: Stripe.Event;
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new Error('Missing signature');
    const bytes = await boundedBody(request, 262144);
    event = stripe().webhooks.constructEvent(
      bytes,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof BodyLimitError)
      return new Response('Payload too large', { status: 413 });
    return new Response('Invalid signature', { status: 400 });
  }
  if (event.livemode !== stripeKeyIsLive(process.env.STRIPE_SECRET_KEY))
    return Response.json({ received: true, ignored: true });
  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isDirectoryMetadata(session.metadata))
        return Response.json({ received: true, ignored: true });
      await fulfill(session.id, event.id, event.type);
      after(() => deliverEmails().catch(() => {}));
    } else if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isDirectoryMetadata(session.metadata))
        return Response.json({ received: true, ignored: true });
      const { error } = await adminClient()
        .from('checkout_attempts')
        .update({
          state:
            event.type === 'checkout.session.expired' ? 'expired' : 'failed',
        })
        .eq('stripe_session_id', session.id)
        .in('state', ['creating', 'open']);
      if (error) throw error;
    } else if (
      event.type === 'charge.refunded' ||
      event.type === 'charge.dispute.created'
    ) {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      const payment = paymentIntentId(object.payment_intent);
      if (
        payment &&
        (event.type !== 'charge.refunded' || (object as Stripe.Charge).refunded)
      ) {
        // Disputes do not inherit the payment's metadata. Verify the original
        // PaymentIntent before recording revocation, including early events.
        const intent = await stripe().paymentIntents.retrieve(payment);
        if (
          !isDirectoryMetadata(intent.metadata) ||
          intent.livemode !== event.livemode
        )
          return Response.json({ received: true, ignored: true });
        const { error } = await adminClient().rpc('revoke_payment', {
          p_payment: payment,
          p_state: event.type === 'charge.refunded' ? 'refunded' : 'disputed',
          p_event: event.id,
        });
        if (error) throw error;
      }
    }
    return Response.json({ received: true });
  } catch {
    console.error('stripe_fulfillment_failed', event.id);
    return new Response('Fulfillment must retry', { status: 500 });
  }
}
