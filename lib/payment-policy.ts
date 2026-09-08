export type CheckoutEvidence = {
  mode: string | null;
  status: string | null;
  payment_status: string;
  currency: string | null;
  amount_total: number | null;
  livemode: boolean;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_intent: unknown;
};
export const directoryPaymentApp = 'ruagentic-directory';
export function isDirectoryMetadata(metadata: unknown) {
  return (
    metadata !== null &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).app === directoryPaymentApp
  );
}
export function paymentIntentId(reference: unknown) {
  const id =
    typeof reference === 'string'
      ? reference
      : reference !== null &&
          typeof reference === 'object' &&
          !Array.isArray(reference)
        ? (reference as { id?: unknown }).id
        : null;
  return typeof id === 'string' && /^pi_[A-Za-z0-9]+$/.test(id) ? id : null;
}
export const stripeKeyIsLive = (key: string | undefined) =>
  /^(sk|rk)_live_/.test(key ?? '');
export function verifiedCheckout(
  session: CheckoutEvidence,
  attempt: {
    id: string;
    submission_id: string;
    revision: number;
    identity_key: string;
    stripe_session_id: string | null;
  },
  expected: { priceId: string; live: boolean; sessionId: string },
  items: {
    priceId: string | undefined;
    quantity: number | null;
    amount: number;
  }[],
) {
  return (
    session.mode === 'payment' &&
    session.status === 'complete' &&
    session.payment_status === 'paid' &&
    session.currency === 'usd' &&
    session.amount_total === 4999 &&
    session.livemode === expected.live &&
    isDirectoryMetadata(session.metadata) &&
    session.client_reference_id === attempt.submission_id &&
    session.metadata?.submission_id === attempt.submission_id &&
    session.metadata?.attempt_id === attempt.id &&
    session.metadata?.revision === String(attempt.revision) &&
    (!attempt.stripe_session_id ||
      attempt.stripe_session_id === expected.sessionId) &&
    items.length === 1 &&
    items[0].priceId === expected.priceId &&
    items[0].quantity === 1 &&
    items[0].amount === 4999 &&
    typeof session.payment_intent === 'string' &&
    session.payment_intent.startsWith('pi_') &&
    session.payment_intent.length > 3
  );
}
