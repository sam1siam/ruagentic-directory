import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifiedCheckout,
  type CheckoutEvidence,
} from '../lib/payment-policy.ts';

const attempt = {
  id: 'attempt-1',
  submission_id: 'submission-1',
  revision: 7,
  identity_key: 'https://example.com',
  stripe_session_id: 'cs_expected',
};
const expected = {
  priceId: 'price_listing',
  live: true,
  sessionId: 'cs_expected',
};
const items = [{ priceId: 'price_listing', quantity: 1, amount: 4999 }];
const session: CheckoutEvidence = {
  mode: 'payment',
  status: 'complete',
  payment_status: 'paid',
  currency: 'usd',
  amount_total: 4999,
  livemode: true,
  client_reference_id: 'submission-1',
  metadata: { attempt_id: 'attempt-1', revision: '7' },
  payment_intent: 'pi_expected',
};

await test('a completed checkout is bound to its price, submission revision, payment intent, and live mode', () => {
  assert.equal(verifiedCheckout(session, attempt, expected, items), true);
  assert.equal(
    verifiedCheckout(
      session,
      { ...attempt, stripe_session_id: null },
      expected,
      items,
    ),
    true,
  );
  assert.equal(
    verifiedCheckout(
      { ...session, livemode: false },
      attempt,
      { ...expected, live: false },
      items,
    ),
    true,
  );
});

await test('unfinished, unpaid, wrong-currency, wrong-amount, or wrong-mode checkouts cannot publish', () => {
  const rejected: Partial<CheckoutEvidence>[] = [
    { mode: 'subscription' },
    { mode: null },
    { status: 'open' },
    { status: 'expired' },
    { status: null },
    { payment_status: 'unpaid' },
    { payment_status: 'no_payment_required' },
    { currency: 'cad' },
    { currency: null },
    { amount_total: 4998 },
    { amount_total: 5000 },
    { amount_total: null },
    { livemode: false },
    { payment_intent: null },
    { payment_intent: { id: 'pi_expanded' } },
    { payment_intent: '' },
    { payment_intent: 'pi_' },
    { payment_intent: 'cs_wrong_resource' },
  ];
  for (const change of rejected)
    assert.equal(
      verifiedCheckout({ ...session, ...change }, attempt, expected, items),
      false,
      JSON.stringify(change),
    );
});

await test('checkout evidence for another submission, attempt, revision, or session cannot be reused', () => {
  const rejected: Partial<CheckoutEvidence>[] = [
    { client_reference_id: 'submission-other' },
    { client_reference_id: null },
    { metadata: null },
    { metadata: {} },
    { metadata: { attempt_id: 'attempt-other', revision: '7' } },
    { metadata: { attempt_id: 'attempt-1', revision: '6' } },
    { metadata: { attempt_id: 'attempt-1', revision: '07' } },
    { metadata: { attempt_id: 'attempt-1' } },
  ];
  for (const change of rejected)
    assert.equal(
      verifiedCheckout({ ...session, ...change }, attempt, expected, items),
      false,
      JSON.stringify(change),
    );
  assert.equal(
    verifiedCheckout(
      session,
      { ...attempt, stripe_session_id: 'cs_other' },
      expected,
      items,
    ),
    false,
  );
  assert.equal(
    verifiedCheckout(session, { ...attempt, revision: 8 }, expected, items),
    false,
  );
});

await test('one payment for the configured listing price is required, even when the checkout total matches', () => {
  const rejected: (typeof items)[] = [
    [],
    [...items, ...items],
    [{ priceId: 'price_other', quantity: 1, amount: 4999 }],
    [{ priceId: 'price_listing', quantity: 2, amount: 4999 }],
    [{ priceId: 'price_listing', quantity: 0, amount: 4999 }],
    [{ priceId: 'price_listing', quantity: 1, amount: 4998 }],
  ];
  for (const lines of rejected)
    assert.equal(
      verifiedCheckout(session, attempt, expected, lines),
      false,
      JSON.stringify(lines),
    );
  assert.equal(
    verifiedCheckout(session, attempt, expected, [
      { priceId: undefined, quantity: 1, amount: 4999 },
    ]),
    false,
  );
  assert.equal(
    verifiedCheckout(session, attempt, expected, [
      { priceId: 'price_listing', quantity: null, amount: 4999 },
    ]),
    false,
  );
});
