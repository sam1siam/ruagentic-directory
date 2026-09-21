import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProviderCooldown,
  ProviderPacer,
} from '../lib/discovery/rate-limit.ts';
import { runDiscovery } from '../lib/discovery/run.ts';
import { apiJson, ProviderError } from '../lib/discovery/http.ts';
import { Smartlead } from '../lib/discovery/smartlead.ts';
import type { CandidateRow, DiscoveryStore } from '../lib/discovery/store.ts';

void test('A Findymail account failure leaves its candidate pending and enrolls a later Prospeo contact', async (t) => {
  const keys = [
    'DISCOVERY_ENRICHMENT_ENABLED',
    'PROSPEO_API_KEY',
    'SMARTLEAD_API_KEY',
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => {
    process.env[key] =
      key === 'DISCOVERY_ENRICHMENT_ENABLED' ? 'true' : 'fixture';
  });
  t.after(() =>
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }),
  );
  const rows: CandidateRow[] = [0, 1].map((i) => ({
    id: `fallback-fixture-${i}`,
    source: 'github',
    status: 'pending',
    attempts: 0,
    reason: null,
    contact: null,
    data: {
      source: 'github',
      id: `fallback-fixture-${i}`,
      name: `Unique Fallback Fixture ${i}`,
      description: 'An MCP server',
      kind: 'mcp-server',
      sourceUrl: `https://github.com/fallback-fixture-${i}/server`,
      homepage: `https://fallback-fixture-${i}.com`,
    },
  }));
  const updates = new Map<string, Record<string, unknown>>();
  const table = {
    select: () => table,
    order: () => table,
    eq: () => table,
    range: async () => ({ data: [], error: null }),
    single: async () => ({ data: { status: 'retry' }, error: null }),
  };
  const store = {
    db: { from: () => table },
    claim: async () => 'owner',
    source: async (source: string) => ({
      source,
      initialized_at: null,
      last_success_at: null,
      seen_keys: [],
    }),
    commit: async () => ({ observed: 0, newCandidates: 0, baseline: false }),
    outreach: async () => [],
    pending: async () => rows,
    update: async (id: string, values: Record<string, unknown>) => {
      updates.set(id, { ...updates.get(id), ...values });
    },
    budget: async () => true,
    reserve: async () => true,
    completeOutreach: async () => {},
    finish: async () => {},
  } as unknown as DiscoveryStore;
  t.mock.method(Smartlead.prototype, 'exists', async () => false);
  const imports = t.mock.method(Smartlead.prototype, 'import', async () => ({
    status: 'enrolled',
    accepted: 1,
  }));
  let lookups = 0;
  let sharedState: unknown;
  const report = await runDiscovery({
    store,
    account: async () => null,
    snapshot: async (source) => ({ source, items: [], complete: true }),
    contact: async (item, _deadline, _budget, _api, _reader, state) => {
      lookups++;
      if (lookups === 1) {
        sharedState = state;
        throw new ProviderError('app.findymail.com', 402);
      }
      assert.equal(state, sharedState);
      return {
        email: 'alice@fallback-fixture-1.com',
        companyDomain: 'fallback-fixture-1.com',
        firstName: 'Alice',
        fullName: 'Alice Example',
        role: 'Founder',
        provider: 'Prospeo verified founder',
        evidence: item.sourceUrl,
        verifiedAt: new Date().toISOString(),
      };
    },
  });
  assert.ok('candidates' in report);
  assert.equal(report.candidates.deferred, 1);
  assert.equal(report.candidates.enrolled, 1);
  assert.equal(report.candidates.failed, 0);
  assert.equal(imports.mock.callCount(), 1);
  assert.equal(updates.get(rows[0]!.id)?.status, 'pending');
  assert.equal(updates.get(rows[0]!.id)?.attempts, 0);
  assert.equal(updates.get(rows[1]!.id)?.status, 'enrolled');
  assert.match(report.issues.join(' '), /Prospeo enrichment continues/);
});

function clockFixture() {
  let now = 1_000_000;
  const sleeps: number[] = [];
  const pacer = new ProviderPacer({
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  });
  return { pacer, sleeps, now: () => now };
}

void test('Smartlead respects both seconds and HTTP-date Retry-After values across endpoints', async () => {
  for (const httpDate of [false, true]) {
    const { pacer, sleeps, now } = clockFixture();
    const lookup = new URL('https://server.smartlead.ai/api/v1/leads/');
    await pacer.wait(lookup, now() + 600_000);
    const retry = httpDate ? new Date(now() + 120_000).toUTCString() : '120';
    assert.ok(
      pacer.observe(lookup, new Headers({ 'retry-after': retry }), 429) >= 120,
    );
    await assert.rejects(pacer.wait(lookup, now() + 60_000), ProviderCooldown);
    await pacer.wait(
      new URL('https://server.smartlead.ai/api/v1/campaigns/fixture/leads'),
      now() + 600_000,
    );
    assert.ok(sleeps[0]! >= 120_000);
  }
});

void test('GitHub secondary 403 limits pause core and search while primary limits stay separate', async () => {
  const { pacer, sleeps, now } = clockFixture();
  const search = new URL('https://api.github.com/search/repositories');
  const core = new URL('https://api.github.com/repos/fixture/project');
  assert.ok(
    pacer.observe(
      search,
      new Headers({
        'retry-after': '120',
        'x-ratelimit-remaining': '29',
      }),
      403,
    ) >= 120,
  );
  await assert.rejects(pacer.wait(core, now() + 60_000), ProviderCooldown);
  await pacer.wait(core, now() + 600_000);
  assert.ok(sleeps[0]! >= 120_000);

  const primary = clockFixture();
  primary.pacer.observe(
    search,
    new Headers({
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String((primary.now() + 120_000) / 1000),
    }),
    403,
  );
  await primary.pacer.wait(core, primary.now() + 60_000);
  assert.deepEqual(primary.sleeps, []);
});

void test('GitHub secondary limits without Retry-After wait at least a minute', async () => {
  const { pacer, sleeps, now } = clockFixture();
  const core = new URL('https://api.github.com/repos/fixture/project');
  assert.ok(pacer.observe(core, new Headers(), 403, true) >= 60);
  await pacer.wait(core, now() + 600_000);
  assert.ok(sleeps[0]! >= 60_000);

  const ordinary = clockFixture();
  ordinary.pacer.observe(core, new Headers(), 403);
  await ordinary.pacer.wait(core, ordinary.now() + 60_000);
  assert.deepEqual(ordinary.sleeps, []);
});

void test('A GitHub call already waiting rechecks a newly received secondary cooldown', async () => {
  let now = 1_000_000;
  let wake: (() => void) | undefined;
  const pacer = new ProviderPacer({
    now: () => now,
    sleep: (ms) =>
      new Promise<void>((resolve) => {
        wake = () => {
          now += ms;
          resolve();
        };
      }),
  });
  const core = new URL('https://api.github.com/repos/fixture/project');
  await pacer.wait(core, now + 60_000);
  const queued = pacer.wait(core, now + 60_000);
  pacer.observe(
    new URL('https://api.github.com/search/repositories'),
    new Headers({ 'retry-after': '120' }),
    403,
  );
  assert.ok(wake);
  const rejected = assert.rejects(queued, ProviderCooldown);
  wake();
  await rejected;
});

void test('Rate-limit headers take effect even when the response body is interrupted', async (t) => {
  const fetched = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('Response interrupted'));
          },
        }),
        {
          status: 403,
          headers: { 'Retry-After': '120', 'x-ratelimit-remaining': '4999' },
        },
      ),
  );
  const url = 'https://api.github.com/repos/fixture/project';
  await assert.rejects(
    apiJson(url, {}, Date.now() + 60_000),
    /Response interrupted/,
  );
  await assert.rejects(apiJson(url, {}, Date.now() + 60_000), ProviderCooldown);
  assert.equal(fetched.mock.callCount(), 1);
});

void test('A long Smartlead cooldown stops the run after one lookup and leaves candidates queued', async (t) => {
  const keys = [
    'DISCOVERY_ENRICHMENT_ENABLED',
    'PROSPEO_API_KEY',
    'SMARTLEAD_API_KEY',
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  });
  process.env.DISCOVERY_ENRICHMENT_ENABLED = 'true';
  process.env.PROSPEO_API_KEY = 'fixture';
  process.env.SMARTLEAD_API_KEY = 'fixture';
  let requests = 0;
  globalThis.fetch = async (url) => {
    const target =
      typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    assert.equal(new URL(target).hostname, 'server.smartlead.ai');
    requests++;
    return new Response('{}', {
      status: 429,
      // Longer than the run's 770-second budget, so the run stops rather than waits.
      headers: { 'Retry-After': '1200' },
    });
  };
  const rows: CandidateRow[] = Array.from({ length: 3 }, (_, i) => ({
    id: `fixture-${i}`,
    source: 'github',
    status: 'contact_ready',
    attempts: 1,
    reason: null,
    contact: {
      email: `founder@audit-fixture-${i}.com`,
      companyDomain: `audit-fixture-${i}.com`,
      firstName: 'Test',
      fullName: 'Test Founder',
      provider: 'fixture',
      evidence: 'fixture',
      verifiedAt: '2026-09-13T00:00:00Z',
    },
    data: {
      source: 'github',
      id: `fixture-${i}`,
      name: `Unique Audit Fixture ${i}`,
      description: 'An MCP server',
      kind: 'mcp-server',
      sourceUrl: `https://github.com/audit-fixture-${i}/server`,
      homepage: `https://audit-fixture-${i}.com`,
    },
  }));
  const table = {
    select: () => table,
    order: () => table,
    eq: () => table,
    range: async () => ({ data: [], error: null }),
    single: async () => ({ data: { status: 'contact_ready' }, error: null }),
  };
  const updates: { id: string; values: Record<string, unknown> }[] = [];
  const store = {
    db: { from: () => table },
    claim: async () => 'owner',
    source: async (source: string) => ({
      source,
      initialized_at: null,
      last_success_at: null,
      seen_keys: [],
    }),
    commit: async () => ({ observed: 0, newCandidates: 0, baseline: false }),
    outreach: async () => [],
    pending: async () => rows,
    update: async (id: string, values: Record<string, unknown>) => {
      updates.push({ id, values });
    },
    finish: async () => {},
  } as unknown as DiscoveryStore;
  const report = await runDiscovery({
    store,
    account: async () => null,
    snapshot: async (source) => ({ source, items: [], complete: true }),
  });
  assert.equal(requests, 1);
  assert.ok('candidates' in report);
  assert.equal(report.candidates.deferred, 1);
  assert.equal(report.candidates.failed, 0);
  assert.match(report.issues.join(' '), /remaining candidates left queued/);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]!.values.status, 'contact_ready');
  assert.equal(updates[0]!.values.attempts, 1);
});
