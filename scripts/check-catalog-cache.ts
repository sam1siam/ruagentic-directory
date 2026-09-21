// Integration check: real Next.js data cache, loopback-only fake Supabase.
// No production services, accounts, or payment providers are contacted.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareCatalog } from '../lib/catalog-import.ts';

const seed = JSON.parse(
  await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'),
);
const rows = prepareCatalog(seed).map((row) => ({ ...row, visible: true }));
const hidden = new Set<string>();
let catalogReads = 0;
let overrideReads = 0;
let failOverrides = false;
const fixture = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://127.0.0.1');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/rest/v1/catalog_overrides') {
    overrideReads++;
    if (failOverrides) {
      res.writeHead(503);
      res.end(JSON.stringify({ message: 'Fixture unavailable' }));
    } else res.end(JSON.stringify([...hidden].map((slug) => ({ slug }))));
    return;
  }
  if (url.pathname !== '/rest/v1/directory_entries') {
    res.writeHead(404);
    res.end('{}');
    return;
  }
  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const updates = JSON.parse(body);
    for (const update of updates) {
      const row = rows.find((r) => r.slug === update.slug)!;
      row.data = update.data;
    }
    res.end(
      JSON.stringify(updates.map((r: { slug: string }) => ({ slug: r.slug }))),
    );
    return;
  }
  if (url.searchParams.get('select')!.includes('submitted:')) {
    res.end(
      JSON.stringify(rows.map((row) => ({ ...row.data, slug: row.slug }))),
    );
    return;
  }
  catalogReads++;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? rows.length);
  res.end(JSON.stringify(rows.slice(offset, offset + limit)));
});
await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const address = fixture.address() as { port: number };
const portProbe = createServer();
await new Promise<void>((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
const appPort = (portProbe.address() as { port: number }).port;
await new Promise<void>((resolve) => portProbe.close(() => resolve()));
const base = `http://127.0.0.1:${appPort}`;
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(appPort),
  ],
  {
    cwd: new URL('..', import.meta.url),
    windowsHide: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key',
      SUPABASE_SECRET_KEY: 'fixture-secret-key',
      CRON_SECRET: 'fixture-cron-secret',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk;
});
child.stderr.on('data', (chunk) => {
  logs += chunk;
});
const request = (path: string, init?: RequestInit) =>
  fetch(base + path, { ...init, signal: AbortSignal.timeout(90000) });
async function listing(slug: string) {
  return request('/api/v1/listings/' + slug);
}
async function invalidate() {
  // The real seed handler updates this row and expires the real Next cache.
  rows[2]!.data.summary = 'Old fixture summary';
  const response = await request('/api/cron/seed', {
    headers: { authorization: 'Bearer fixture-cron-secret' },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).refreshed, 1);
}
try {
  for (let attempt = 0; !logs.includes('Ready in'); attempt++) {
    assert.equal(child.exitCode, null, logs);
    assert.ok(attempt < 120, logs);
    await delay(500);
  }
  assert.equal((await listing(rows[0]!.slug)).status, 200);
  const cold = { catalogReads, overrideReads };
  assert.equal(catalogReads, Math.floor(rows.length / 100) + 1);
  assert.equal((await listing(rows[1]!.slug)).status, 200);
  assert.equal((await request('/api/v1/listings?limit=1')).status, 200);
  assert.deepEqual(
    { catalogReads, overrideReads },
    cold,
    'Warm requests must not fetch Supabase again',
  );

  rows[0]!.visible = false;
  hidden.add(rows[1]!.slug);
  await invalidate();
  assert.equal(
    (await listing(rows[0]!.slug)).status,
    404,
    'Hidden database row must not return from bundled fallback',
  );
  assert.equal(
    (await listing(rows[1]!.slug)).status,
    404,
    'Admin override must invalidate immediately',
  );
  assert.ok(catalogReads > cold.catalogReads);

  rows[0]!.visible = true;
  hidden.clear();
  await invalidate();
  failOverrides = true;
  assert.equal(
    (await listing(rows[0]!.slug)).status,
    500,
    'Failed visibility lookup must not expose unchecked data',
  );
  failOverrides = false;
  assert.equal(
    (await listing(rows[0]!.slug)).status,
    200,
    'A failed lookup must not poison the shared cache',
  );
  assert.equal((await listing(rows[1]!.slug)).status, 200);
  assert.ok(!logs.includes('Failed to set Next.js data cache'), logs);
  console.log(
    'PASS: cross-request reuse, batching, write invalidation, hidden fallback, restore, and error recovery.',
  );
  console.log(
    JSON.stringify({
      rows: rows.length,
      coldCatalogReads: cold.catalogReads,
      additionalWarmCatalogReads: 0,
    }),
  );
} finally {
  child.kill();
  fixture.closeAllConnections();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
}
