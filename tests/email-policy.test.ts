import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmationEmail,
  escapeHtml,
  retryDecision,
} from '../lib/email-policy.ts';

await test('listing names cannot inject HTML, attributes, or email headers into confirmation messages', () => {
  assert.equal(escapeHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
  const name =
    '<img src=x onerror="alert(1)"> & \'quoted\'\r\nBcc: other@example.com';
  const email = confirmationEmail({ name, slug: 'example', method: 'payment' });
  assert.ok(email.html.includes(escapeHtml(name)));
  assert.ok(!email.html.includes('<img'));
  assert.equal(email.subject, 'Your RUAGENTIC listing is published');
  assert.ok(!/[\r\n]/.test(email.subject));
  assert.ok(email.text.includes(name));
});

await test('listing links encode the slug as one path segment and remain on the directory origin', () => {
  const slug = '../../outside?x="&next=https://attacker.example/#fragment';
  const email = confirmationEmail({ name: 'Example', slug, method: 'agentic' });
  const link = 'https://ruagentic.com/tools/' + encodeURIComponent(slug);
  assert.ok(email.text.includes(link));
  assert.ok(email.html.includes(`href="${link}"`));
  const links = [...email.html.matchAll(/href="([^"]+)"/g)];
  assert.equal(links.length, 2);
  for (const match of links)
    assert.equal(new URL(match[1]).origin, 'https://ruagentic.com');
});

await test('confirmation copy accurately distinguishes payment from the free Agentic publication check', () => {
  const paid = confirmationEmail({
    name: 'Example',
    slug: 'example',
    method: 'payment',
  });
  const free = confirmationEmail({
    name: 'Example',
    slug: 'example',
    method: 'agentic',
  });
  for (const format of ['html', 'text'] as const) {
    assert.match(paid[format], /one-time listing payment is confirmed/);
    assert.match(paid[format], /Stripe sends the payment receipt/);
    assert.doesNotMatch(paid[format], /files passed/);
    assert.match(
      free[format],
      /Agentic files passed the free listing publication check/,
    );
    assert.doesNotMatch(free[format], /payment is confirmed/);
  }
});

await test('email retry backoff starts at 30 seconds, doubles, and is capped at one hour', () => {
  const now = Date.parse('2026-09-08T12:00:00.000Z');
  const firstAttempt = new Date(now - 60_000).toISOString();
  // A claim increments attempts to 1 before a failure is recorded.
  assert.deepEqual(retryDecision(1, firstAttempt, now), {
    state: 'failed',
    next: '2026-09-08T12:00:30.000Z',
  });
  assert.deepEqual(retryDecision(2, firstAttempt, now), {
    state: 'failed',
    next: '2026-09-08T12:01:00.000Z',
  });
  assert.deepEqual(retryDecision(7, firstAttempt, now), {
    state: 'failed',
    next: '2026-09-08T12:32:00.000Z',
  });
  assert.ok(
    Date.parse(retryDecision(7, firstAttempt, now).next!) - now <= 3_600_000,
  );
});

await test('unconfirmed mail stops retrying before the provider idempotency window expires', () => {
  const now = Date.parse('2026-09-08T12:00:00.000Z');
  assert.equal(
    retryDecision(2, new Date(now - 22 * 3_600_000).toISOString(), now).state,
    'failed',
  );
  assert.deepEqual(
    retryDecision(2, new Date(now - 23 * 3_600_000 - 1).toISOString(), now),
    { state: 'uncertain', next: null },
  );
  assert.deepEqual(
    retryDecision(8, new Date(now - 60_000).toISOString(), now),
    { state: 'uncertain', next: null },
  );
  assert.deepEqual(
    retryDecision(20, new Date(now - 60_000).toISOString(), now),
    { state: 'uncertain', next: null },
  );
});

await test('invalid retry history fails closed instead of extending the safe retry window', () => {
  const now = Date.parse('2026-09-08T12:00:00.000Z');
  assert.deepEqual(retryDecision(1, 'invalid timestamp', now), {
    state: 'uncertain',
    next: null,
  });
  assert.deepEqual(
    retryDecision(Number.NaN, new Date(now).toISOString(), now),
    { state: 'uncertain', next: null },
  );
  assert.deepEqual(
    retryDecision(Number.POSITIVE_INFINITY, new Date(now).toISOString(), now),
    { state: 'uncertain', next: null },
  );
});
