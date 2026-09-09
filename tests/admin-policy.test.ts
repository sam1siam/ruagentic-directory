import test from 'node:test';
import assert from 'node:assert/strict';
import { adminEmails, isAdminEmail } from '../lib/admin-policy.ts';
import {
  sponsorshipDecisionEmail,
  sponsorshipEmail,
} from '../lib/email-policy.ts';

await test('admin access is limited to the configured mailbox', () => {
  assert.deepEqual(adminEmails(undefined), ['hello@ruagentic.com']);
  assert.deepEqual(adminEmails(' A@x.io, b@y.io ,'), ['a@x.io', 'b@y.io']);
  assert.ok(isAdminEmail('Hello@RUAGENTIC.com', undefined));
  assert.ok(!isAdminEmail('someone@else.com', undefined));
  assert.ok(!isAdminEmail(null, undefined));
  assert.ok(!isAdminEmail('', 'hello@ruagentic.com'));
});

await test('sponsor emails promise a review and report the decision', () => {
  const received = sponsorshipEmail({
    product: 'Acme',
    placement: 'Featured card',
    categories: ['finance'],
    total: 'US$499',
    slug: 'acme-abc123',
    livemode: true,
  });
  assert.match(received.subject, /review/i);
  assert.match(received.text, /24–48 hours/);
  assert.match(received.text, /sponsors\/acme-abc123/);
  const approved = sponsorshipDecisionEmail({
    decision: 'approved',
    product: 'Acme',
    placement: 'Featured card',
    slug: 'acme-abc123',
    note: '',
  });
  assert.match(approved.subject, /live/i);
  const rejected = sponsorshipDecisionEmail({
    decision: 'rejected',
    product: 'Acme',
    placement: 'Featured card',
    slug: 'acme-abc123',
    note: 'The tagline makes an unverifiable claim.',
  });
  assert.match(rejected.text, /unverifiable claim/);
  assert.match(rejected.html, /unverifiable claim/);
  assert.match(rejected.text, /Edit your creative from your dashboard/);
  assert.ok(!rejected.html.includes('<script'));
  const refunded = sponsorshipDecisionEmail({
    decision: 'rejected',
    product: 'Acme',
    placement: 'Featured card',
    slug: 'acme-abc123',
    note: 'Not a fit for the directory.',
    refunded: { amount: 'US$499' },
  });
  assert.match(refunded.subject, /refunded/i);
  assert.match(refunded.text, /refunded US\$499/);
  assert.match(refunded.text, /nothing further is due/);
});
