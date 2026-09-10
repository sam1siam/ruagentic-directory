import assert from 'node:assert/strict';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
const base = process.env.CHECK_BASE ?? 'http://localhost:3207';
const paths = [
  '/',
  '/servers',
  '/clients',
  '/ai-agents',
  '/categories',
  '/categories/developer-tools',
  '/advertise',
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
  '/llms-full.txt',
  '/.well-known/security.txt',
  '/openapi.json',
  '/sitemap.xml',
  '/robots.txt',
];
for (const path of paths) {
  const res = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
  assert.equal(res.status, 200, path);
}
for (const [path, type] of [
  ['/favicon.ico', 'image/x-icon'],
  ['/apple-icon.png', 'image/png'],
  ['/icon-192.png', 'image/png'],
  ['/icon-512.png', 'image/png'],
  ['/manifest.webmanifest', 'application/manifest\\+json'],
  ['/opengraph-image', 'image/png'],
  ['/servers/opengraph-image', 'image/png'],
  ['/categories/developer-tools/opengraph-image', 'image/png'],
]) {
  const res = await fetch(base + path, { signal: AbortSignal.timeout(60000) });
  assert.equal(res.status, 200, path);
  assert.match(res.headers.get('content-type') ?? '', new RegExp(type), path);
}
const home = await (await fetch(base + '/')).text();
assert.match(home, /"@type":"WebSite"/);
assert.match(home, /"@type":"Organization"/);
const category = await (
  await fetch(base + '/categories/developer-tools')
).text();
assert.match(category, /"@type":"BreadcrumbList"/);
assert.match(category, /"@type":"ItemList"/);
const security = await (await fetch(base + '/.well-known/security.txt')).text();
assert.match(security, /^Contact: mailto:/m);
assert.match(security, /^Expires: 20/m);
const full = await (await fetch(base + '/llms-full.txt')).text();
assert.match(full, /^## Categories$/m);
assert.match(full, /^## MCP servers \(\d+\)$/m);
assert.match(home, /<link rel="canonical" href="https:\/\/ruagentic\.com\/"/);
assert.match(home, /<meta property="og:image" content="[^"]*opengraph-image/);
assert.match(home, /<meta name="twitter:card" content="summary_large_image"/);
assert.match(home, /<link rel="icon" href="\/favicon\.ico"/);
assert.match(home, /<link rel="apple-touch-icon" href="\/apple-icon/);
assert.match(home, /<link rel="manifest" href="\/manifest\.webmanifest"/);
const list = await (await fetch(base + '/api/v1/listings?limit=2')).json();
assert.equal(list.listings.length, 2);
assert.ok(list.total >= 160, 'bundled catalog must be served in full');
assert.equal(list.nextOffset, 2);
const first = list.listings[0];
const listingImage = await fetch(
  base + '/tools/' + first.slug + '/opengraph-image',
  { signal: AbortSignal.timeout(60000) },
);
assert.equal(listingImage.status, 200);
assert.match(listingImage.headers.get('content-type') ?? '', /image\/png/);
const badge = await fetch(base + '/badge/' + first.slug + '.svg');
assert.equal(badge.status, 200);
assert.match(badge.headers.get('content-type') ?? '', /image\/svg\+xml/);
assert.match(await badge.text(), /LISTED ON RUAGENTIC/);
const card = await fetch(base + '/embed/' + first.slug + '.svg');
assert.equal(card.status, 200);
assert.match(await card.text(), /ruagentic\.com\/tools\//);
const frame = await fetch(base + '/embed/' + first.slug);
assert.equal(frame.status, 200);
assert.match(frame.headers.get('content-type') ?? '', /text\/html/);
assert.match(
  frame.headers.get('content-security-policy') ?? '',
  /frame-ancestors \*/,
);
assert.equal(frame.headers.get('x-frame-options'), null);
assert.equal(frame.headers.get('x-robots-tag'), 'noindex');
assert.match(await frame.text(), /target="_top"/);
assert.equal((await fetch(base + '/badge/nope.svg')).status, 404);
assert.equal((await fetch(base + '/embed/nope')).status, 404);
assert.equal(
  (await fetch(base + '/tools/' + first.slug)).headers.get('x-frame-options'),
  'DENY',
);
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
assert.equal(
  (await fetch(base + '/tools/not-a-real-directory-entry')).status,
  404,
  'unknown listings must be real 404s, not streamed 200s',
);
assert.equal(
  (await fetch(base + '/categories/not-a-real-category')).status,
  404,
  'unknown categories must be real 404s, not streamed 200s',
);
assert.equal(
  (await fetch(base + '/sponsors/not-a-real-sponsor')).status,
  404,
  'unknown sponsors must be real 404s',
);
assert.equal((await fetch(base + '/tools/astrofabric')).status, 200);
{
  const moved = await fetch(base + '/collections', { redirect: 'manual' });
  assert.equal(moved.status, 308);
  assert.equal(
    new URL(moved.headers.get('location')!, base).pathname,
    '/categories',
  );
}
{
  const gated = await fetch(base + '/admin', { redirect: 'manual' });
  assert.ok(
    [302, 303, 307, 308].includes(gated.status),
    'signed-out admin must redirect on the server, got ' + gated.status,
  );
  const bootstrap = await fetch(base + '/api/admin/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(
    bootstrap.status,
    401,
    'admin bootstrap must require the secret',
  );
}
{
  const gated = await fetch(base + '/dashboard', { redirect: 'manual' });
  assert.ok(
    [302, 303, 307, 308].includes(gated.status),
    'signed-out dashboard must redirect on the server, got ' + gated.status,
  );
}
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
for (const job of ['email', 'seed', 'health']) {
  const cron = await fetch(base + '/api/cron/' + job);
  assert.equal(cron.status, 401, 'cron ' + job + ' must require the secret');
}
const foreignAd = await fetch(base + '/api/advertise/checkout', {
  method: 'POST',
  headers: {
    Origin: 'https://other.example',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(foreignAd.status, 403, 'sponsor checkout must be same-origin');
const anonymousAd = await fetch(base + '/api/advertise/checkout', {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: '{}',
});
assert.ok(
  [401, 503].includes(anonymousAd.status),
  'sponsor checkout must require an account, got ' + anonymousAd.status,
);
const anonymousPortal = await fetch(base + '/api/sponsorships/portal', {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: '{}',
});
assert.ok(
  [401, 503].includes(anonymousPortal.status),
  'billing portal must require an account, got ' + anonymousPortal.status,
);
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
  'PASS public pages, category and kind routes, search/pagination, listing detail, error routes, unauthenticated boundaries, cron protection, unsigned webhooks, and official MCP client discovery/search.',
);
console.log(
  'Authenticated publishing, actual Stripe payments, email delivery, DNS and browser WebMCP require separately configured integration checks.',
);
