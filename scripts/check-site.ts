import assert from 'node:assert/strict';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
const base = process.env.CHECK_BASE ?? 'http://localhost:3207';
const paths = [
  '/',
  '/collections',
  '/compare',
  '/pricing',
  '/about',
  '/guidelines',
  '/contact',
  '/developers',
  '/privacy',
  '/terms',
  '/login',
  '/submit',
  '/agentic.json',
  '/agentic.txt',
  '/README.md',
  '/llms.txt',
  '/openapi.json',
  '/sitemap.xml',
  '/robots.txt',
];
for (const path of paths) {
  const res = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
  assert.equal(res.status, 200, path);
}
const list = await (await fetch(base + '/api/v1/listings?limit=2')).json();
assert.equal(list.listings.length, 2);
assert.ok(list.total >= 31);
assert.equal(list.nextOffset, 2);
const first = list.listings[0];
for (const method of ['GET', 'HEAD']) {
  const confirmation = await fetch(
    base + '/auth/confirm?type=email&token_hash=' + 'a'.repeat(64),
    { method, redirect: 'manual' },
  );
  assert.equal(confirmation.status, 200);
  assert.equal(confirmation.headers.get('cache-control'), 'private, no-store');
  assert.equal(confirmation.headers.get('referrer-policy'), 'strict-origin');
  const content = await confirmation.text();
  if (method === 'GET')
    assert.match(content, /<form method="post" action="\/auth\/confirm">/);
  else assert.equal(content, '');
}
for (const path of [
  '/auth/callback?next=%2Fsubmit%3Fedit%3D123',
  '/auth/confirm?next=%2Fsubmit%3Fedit%3D123',
  '/auth/confirm?type=recovery',
  '/auth/callback?next=https%3A%2F%2Fother.example',
]) {
  const response = await fetch(base + path, { redirect: 'manual' });
  assert.equal(response.status, path.startsWith('/auth/callback') ? 303 : 307);
  const destination = new URL(response.headers.get('location')!);
  assert.equal(destination.pathname, '/login');
  assert.equal(
    destination.searchParams.get('error'),
    path.startsWith('/auth/callback') ? 'oauth' : 'link',
  );
  assert.equal(
    destination.searchParams.get('next'),
    path.includes('recovery')
      ? '/reset-password'
      : path.includes('other.example')
        ? '/dashboard'
        : '/submit?edit=123',
  );
}
assert.equal((await fetch(base + '/tools/' + first.slug)).status, 200);
assert.equal(
  (await fetch(base + '/api/v1/listings/' + first.slug)).status,
  200,
);
assert.equal(
  (await fetch(base + '/api/v1/listings/not-a-real-directory-entry')).status,
  404,
);
const empty = await (
  await fetch(base + '/api/v1/listings?q=zzzz-no-such-project-zzzz')
).json();
assert.equal(empty.total, 0);
const unauthorized = await fetch(base + '/api/submissions');
assert.ok(
  [401, 503].includes(unauthorized.status),
  'Account API must not leak submissions without a session',
);
const forbidden = await fetch(base + '/api/submissions', {
  method: 'POST',
  headers: {
    Origin: 'https://other.example',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(forbidden.status, 403);
const cron = await fetch(base + '/api/cron/email');
assert.equal(cron.status, 401);
const webhook = await fetch(base + '/api/webhooks/stripe', {
  method: 'POST',
  body: '{}',
});
assert.ok(
  [400, 503].includes(webhook.status),
  'Unsigned payment events must not be accepted',
);
const mcp = new Client({ name: 'ruagentic-directory-check', version: '1.0.0' });
try {
  await mcp.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
  const tools = await mcp.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), [
    'get_listing',
    'search_directory',
  ]);
  const found = await mcp.callTool({
    name: 'search_directory',
    arguments: { query: '', limit: 2 },
  });
  assert.ok(!found.isError);
  const text = found.content.find((c) => c.type === 'text');
  assert.ok(text && text.type === 'text');
  assert.equal(JSON.parse(text.text).listings.length, 2);
  const missing = await mcp.callTool({
    name: 'get_listing',
    arguments: { slug: 'not-a-real-directory-entry' },
  });
  assert.equal(missing.isError, true);
} finally {
  await mcp.close();
}
console.log(
  'PASS public pages, search/pagination, listing detail, error routes, unauthenticated boundaries, cron protection, unsigned webhooks, and official MCP client discovery/search.',
);
console.log(
  'Authenticated publishing, actual Stripe payments, email delivery, DNS and browser WebMCP require separately configured integration checks.',
);
