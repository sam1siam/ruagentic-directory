import Stripe from 'stripe';
import { z } from 'zod';
import { adminClient } from '../supabase/server';
import { appUrl, HttpError } from './http';
import { ownedSubmission, revisionInput, databaseError } from './submissions';
import { listingPrice } from '../listing';
import {
  verifiedCheckout,
  directoryPaymentApp,
  isDirectoryMetadata,
  stripeKeyIsLive,
} from '../payment-policy';
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !process.env.STRIPE_PRICE_ID)
    throw new HttpError(
      503,
      'Payments are temporarily unavailable. Your listing is saved; please try again shortly.',
    );
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
}
export async function startCheckout(owner: string, input: unknown) {
  const { id, revision } = revisionInput
    .extend({ acceptedTerms: z.literal(true) })
    .strict()
    .parse(input);
  const service = stripe(),
    db = adminClient();
  const s = await ownedSubmission(owner, id);
  const { data: attempt, error } = await db.rpc('begin_checkout', {
    p_owner: owner,
    p_id: id,
    p_revision: revision,
    p_terms: listingPrice.termsVersion,
  });
  if (error) databaseError(error);
  if (attempt.state === 'paid') return { paid: true, evidenceId: attempt.id };
  if (attempt.stripe_session_id) {
    const session = await service.checkout.sessions.retrieve(
      attempt.stripe_session_id,
    );
    if (session.status === 'complete') {
      const result = await fulfill(
        session.id,
        'reconcile:' + session.id,
        'checkout.reconcile',
      );
      if (result.state === 'revoked')
        throw new HttpError(
          409,
          'This payment was refunded or disputed. Contact support to continue.',
        );
      return {
        paid: result.state === 'paid',
        pending: result.state !== 'paid',
        evidenceId: attempt.id,
      };
    }
    if (session.status === 'expired') {
      await db
        .from('checkout_attempts')
        .update({ state: 'expired' })
        .eq('id', attempt.id)
        .eq('state', 'open');
      throw new HttpError(
        409,
        'The previous checkout expired. Continue again to open a new checkout.',
      );
    }
    return { url: session.url };
  }
  if (Date.now() - Date.parse(attempt.created_at) > 23 * 3600000)
    throw new HttpError(
      409,
      'The previous checkout needs reconciliation. Contact support before trying another payment.',
    );
  const metadata = {
    app: directoryPaymentApp,
    attempt_id: attempt.id,
    submission_id: id,
    revision: String(attempt.revision),
  };
  const session = await service.checkout.sessions.create(
    {
      mode: 'payment',
      client_reference_id: id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: appUrl() + '/submit?id=' + id + '&checkout=complete',
      cancel_url: appUrl() + '/submit?id=' + id + '&checkout=cancelled',
      metadata,
      payment_intent_data: { metadata },
      consent_collection: { terms_of_service: 'required' },
      branding_settings: {
        display_name: 'RUAGENTIC',
        background_color: '#0b0d0f',
        button_color: '#bcf36c',
      },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            'I agree to the [RUAGENTIC Terms](https://ruagentic.com/terms).',
        },
        submit: {
          message:
            'One-time US$49.99 directory listing for ' +
            s.payload.name +
            '. Payment does not certify ownership or security.',
        },
      },
    },
    { idempotencyKey: 'directory-checkout:' + attempt.id },
  );
  const saved = await db
    .from('checkout_attempts')
    .update({
      state: 'open',
      stripe_session_id: session.id,
      checkout_url: session.url,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
    })
    .eq('id', attempt.id)
    .eq('state', 'creating');
  if (saved.error) throw saved.error;
  return { url: session.url };
}
export async function fulfill(
  sessionId: string,
  eventId: string,
  eventType: string,
) {
  const service = stripe(),
    session = await service.checkout.sessions.retrieve(sessionId),
    db = adminClient();
  const attemptId = session.metadata?.attempt_id;
  if (
    !isDirectoryMetadata(session.metadata) ||
    !attemptId ||
    !z.uuid().safeParse(attemptId).success
  )
    throw new HttpError(400, 'Unknown checkout.');
  const { data: attempt, error } = await db
    .from('checkout_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();
  if (error) throw error;
  if (session.payment_status !== 'paid') return { state: 'pending' };
  const lines = await service.checkout.sessions.listLineItems(sessionId, {
    limit: 2,
  });
  const valid = verifiedCheckout(
    session,
    attempt,
    {
      priceId: process.env.STRIPE_PRICE_ID!,
      live: stripeKeyIsLive(process.env.STRIPE_SECRET_KEY),
      sessionId,
    },
    lines.data.map((line) => ({
      priceId: line.price?.id,
      quantity: line.quantity,
      amount: line.amount_total,
    })),
  );
  if (!valid || lines.has_more)
    throw new HttpError(400, 'Payment verification failed.');
  const { data, error: commitError } = await db.rpc('fulfill_checkout', {
    p_attempt: attempt.id,
    p_session: sessionId,
    p_payment: session.payment_intent as string,
    p_event: eventId,
    p_event_type: eventType,
  });
  if (commitError) throw commitError;
  return data;
}
export async function cancelCheckout(owner: string, id: string) {
  await ownedSubmission(owner, id);
  const db = adminClient();
  const { data: attempt, error } = await db
    .from('checkout_attempts')
    .select('*')
    .eq('submission_id', id)
    .in('state', ['creating', 'open'])
    .maybeSingle();
  if (error) throw error;
  if (!attempt) return { cancelled: true };
  if (!attempt.stripe_session_id)
    throw new HttpError(
      409,
      'The checkout is still being created. Wait a moment and try again.',
    );
  const service = stripe();
  let session = await service.checkout.sessions.retrieve(
    attempt.stripe_session_id,
  );
  if (session.status === 'open')
    session = await service.checkout.sessions.expire(session.id);
  if (session.status === 'complete') {
    await fulfill(session.id, 'reconcile:' + session.id, 'checkout.reconcile');
    throw new HttpError(
      409,
      'Payment has already completed. Reload your listing to see its status.',
    );
  }
  const updated = await db
    .from('checkout_attempts')
    .update({ state: 'expired' })
    .eq('id', attempt.id)
    .in('state', ['creating', 'open']);
  if (updated.error) throw updated.error;
  return { cancelled: true };
}
