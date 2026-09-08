import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emailNext,
  authRedirect,
  handleOAuthCallback,
} from '../lib/auth-navigation.ts';
import { handleConfirmation } from '../lib/auth-confirmation.ts';
const origin = 'https://ruagentic.com';
await test('email return accepts our final destination and blocks untrusted URLs', () => {
  assert.equal(
    emailNext(origin + '/submit?id=abc&plan=paid', origin),
    '/submit?id=abc&plan=paid',
  );
  assert.equal(emailNext('/submit?plan=paid', origin), '/submit?plan=paid');
  for (const path of [
    'https://other.example/submit',
    '//ruagentic.com/submit',
    origin.replace('://', '://user@') + '/submit',
    '/\\other.example/submit',
    '/submit\n',
    '/submit#fragment',
    origin + '/auth/callback?next=/submit',
  ])
    assert.equal(emailNext(path, origin), '/dashboard');
  assert.equal(
    authRedirect(origin, '/submit?plan=paid', 'github'),
    origin + '/auth/callback?next=%2Fsubmit%3Fplan%3Dpaid',
  );
  assert.equal(
    authRedirect(origin, 'https://other.example', 'email'),
    origin + '/dashboard',
  );
});
await test('OAuth callback exchanges one code, handles cancellation and keeps private redirects', async () => {
  let calls = 0;
  const exchange = async () => {
    calls++;
    return true;
  };
  for (const query of ['', '?code=a&code=b', '?error=access_denied&code=a']) {
    const response = await handleOAuthCallback(
      new Request(origin + '/auth/callback' + query),
      origin,
      exchange,
    );
    assert.equal(response.status, 303);
    assert.match(
      response.headers.get('location')!,
      /^https:\/\/ruagentic\.com\/login\?/,
    );
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(calls, 0);
  const response = await handleOAuthCallback(
    new Request(
      origin + '/auth/callback?code=valid&next=%2Fsubmit%3Fplan%3Dpaid',
    ),
    origin,
    exchange,
  );
  assert.equal(calls, 1);
  assert.equal(response.headers.get('location'), origin + '/submit?plan=paid');
  const failure = await handleOAuthCallback(
    new Request(origin + '/auth/callback?code=valid'),
    origin,
    async () => {
      throw new Error('provider');
    },
  );
  assert.match(failure.headers.get('location')!, /error=unavailable/);
});
await test('email continuation survives scanner landing and submits a same-origin destination', async () => {
  const params = new URLSearchParams({
    token_hash: 'b'.repeat(64),
    type: 'email',
    next: origin + '/submit?id=abc&plan=paid',
  });
  let calls = 0;
  const verify = async () => {
    calls++;
    return true;
  };
  const landing = await handleConfirmation(
    new Request(origin + '/auth/confirm?' + params),
    origin,
    verify,
  );
  assert.match(
    await landing.text(),
    /name="next" value="\/submit\?id=abc&amp;plan=paid"/,
  );
  assert.equal(calls, 0);
  const response = await handleConfirmation(
    new Request(origin + '/auth/confirm', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    }),
    origin,
    verify,
  );
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get('location'),
    origin + '/submit?id=abc&plan=paid',
  );
  assert.equal(calls, 1);
});
