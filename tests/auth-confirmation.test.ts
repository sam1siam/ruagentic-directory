import test from 'node:test';
import assert from 'node:assert/strict';
import { handleConfirmation } from '../lib/auth-confirmation.ts';

const origin = 'https://ruagentic.com';
const token = 'a'.repeat(64);
const fields = new URLSearchParams({
  token_hash: token,
  type: 'email',
  next: '/dashboard',
});
function post(value = fields.toString(), headers: Record<string, string> = {}) {
  return new Request(origin + '/auth/confirm', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: value,
  });
}

await test('email scanner GET and HEAD never consume a confirmation token', async () => {
  let calls = 0;
  const verify = async () => {
    calls++;
    return true;
  };
  for (const method of ['GET', 'HEAD']) {
    const response = await handleConfirmation(
      new Request(origin + '/auth/confirm?' + fields, { method }),
      origin,
      verify,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin');
    assert.match(
      response.headers.get('content-security-policy')!,
      /form-action 'self'/,
    );
    assert.match(response.headers.get('x-robots-tag')!, /noindex/);
    const html = await response.text();
    if (method === 'GET') {
      assert.match(html, /<form method="post" action="\/auth\/confirm">/);
      assert.match(
        html,
        /<button type="submit">Confirm email address<\/button>/,
      );
      assert.doesNotMatch(html, /<script|http-equiv="refresh"|onload=/);
    } else assert.equal(html, '');
  }
  assert.equal(calls, 0);
});

await test('confirmation rejects foreign origins, unsupported bodies and oversized streams before verification', async () => {
  let calls = 0;
  const verify = async () => {
    calls++;
    return true;
  };
  for (const requestOrigin of ['', 'null', 'https://foreign.example']) {
    assert.equal(
      (
        await handleConfirmation(
          post(undefined, { origin: requestOrigin }),
          origin,
          verify,
        )
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await handleConfirmation(
        post('{}', { 'content-type': 'application/json' }),
        origin,
        verify,
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await handleConfirmation(
        post('x'.repeat(4097), { 'content-length': '1' }),
        origin,
        verify,
      )
    ).status,
    413,
  );
  assert.equal(calls, 0);
});

await test('malformed, duplicate and injected confirmation fields cannot verify or create markup', async () => {
  let calls = 0;
  const verify = async () => {
    calls++;
    return true;
  };
  const invalid = [
    fields + '&token_hash=' + token,
    fields + '&type=recovery',
    fields + '&next=/submit',
    new URLSearchParams({
      token_hash: '"><script>alert(1)</script>',
      type: 'email',
    }).toString(),
    new URLSearchParams({ token_hash: token, type: 'magiclink' }).toString(),
  ];
  for (const value of invalid) {
    const response = await handleConfirmation(post(value), origin, verify);
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get('location')!).pathname, '/login');
    assert.doesNotMatch(response.headers.get('location')!, /token_hash|script/);
  }
  const query = new URLSearchParams({
    token_hash: token,
    type: 'email',
    next: '/submit?edit=" onfocus="alert(1)',
  });
  const response = await handleConfirmation(
    new Request(origin + '/auth/confirm?' + query),
    origin,
    verify,
  );
  assert.doesNotMatch(await response.text(), /" onfocus="/);
  assert.equal(calls, 0);
});

await test('explicit confirmation verifies once and redirects without replaying the POST or exposing the token', async () => {
  const calls: unknown[] = [];
  const verify = async (input: unknown) => {
    calls.push(input);
    return true;
  };
  const response = await handleConfirmation(post(), origin, verify);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), origin + '/dashboard');
  assert.deepEqual(calls, [{ token_hash: token, type: 'email' }]);
  const recovery = new URLSearchParams({
    token_hash: token,
    type: 'recovery',
    next: 'https://foreign.example',
  });
  assert.equal(
    (
      await handleConfirmation(post(recovery.toString()), origin, verify)
    ).headers.get('location'),
    origin + '/reset-password',
  );
  const expired = await handleConfirmation(
    post(recovery.toString()),
    origin,
    async () => false,
  );
  assert.equal(expired.status, 303);
  assert.equal(
    new URL(expired.headers.get('location')!).searchParams.get('next'),
    '/reset-password',
  );
  assert.doesNotMatch(expired.headers.get('location')!, /token_hash/);
  assert.equal(
    (
      await handleConfirmation(post(), origin, async () => {
        throw Error('provider unavailable');
      })
    ).status,
    503,
  );
});
