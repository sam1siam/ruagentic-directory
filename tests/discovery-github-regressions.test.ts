import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTOFF, digest } from '../lib/discovery/policy.ts';
import {
  fetchSnapshot,
  githubSnapshot,
  parseGithubSearch,
} from '../lib/discovery/sources.ts';
import { DiscoveryStore } from '../lib/discovery/store.ts';

const repository = (name: string, extra: Record<string, unknown> = {}) => ({
  full_name: `example/${name}`,
  name,
  html_url: `https://github.com/example/${name}`,
  private: false,
  visibility: 'public',
  description: 'An MCP server',
  homepage: 'https://example.com',
  fork: false,
  archived: false,
  created_at: '2026-09-10T12:00:00Z',
  ...extra,
});

void test('GitHub discovery accepts only explicitly public repository metadata', async () => {
  const items = [
    repository('public'),
    // GitHub also documents search responses with private:false and no visibility.
    repository('public-without-visibility', { visibility: undefined }),
    repository('private', { private: true, visibility: 'private' }),
    repository('contradictory', { private: true }),
    repository('internal', { visibility: 'internal' }),
    repository('unknown-visibility', { visibility: 'unknown' }),
    repository('null-visibility', { visibility: null }),
    repository('missing-private', { private: undefined }),
    repository('null-private', { private: null }),
  ];
  const data = { total_count: items.length, incomplete_results: false, items };
  assert.deepEqual(
    parseGithubSearch(data, 'mcp-server').map((item) => item.id),
    ['example/public', 'example/public-without-visibility'],
  );
  const queries: string[] = [];
  const snapshot = await githubSnapshot(
    Date.now() + 60_000,
    new Set(),
    CUTOFF,
    async (url) => {
      const query = new URL(url).searchParams.get('q')!;
      queries.push(query);
      assert.ok(query.split(' ').includes('is:public'));
      return data;
    },
  );
  assert.equal(snapshot.complete, true);
  assert.equal(queries.length, 2);
  assert.deepEqual(
    snapshot.items.map((item) => item.id),
    ['example/public', 'example/public-without-visibility'],
  );
});

void test('Incomplete GitHub searches save public matches and keep the window open', async (t) => {
  const fetched = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          total_count: 3,
          incomplete_results: true,
          items: [
            repository('found'),
            repository('private', { private: true, visibility: 'private' }),
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  );
  const snapshot = await fetchSnapshot('github', Date.now() + 60_000);
  assert.equal(fetched.mock.callCount(), 1);
  assert.equal(snapshot.complete, false);
  assert.equal(snapshot.partial, true);
  assert.match(snapshot.error ?? '', /incomplete results/);
  assert.deepEqual(
    snapshot.items.map((item) => item.id),
    ['example/found'],
  );

  const writes: {
    table: string;
    value: Record<string, unknown> | unknown[];
  }[] = [];
  const db = {
    from: (table: string) => ({
      upsert: async (value: unknown[]) => {
        writes.push({ table, value });
        return { error: null };
      },
      update: (value: Record<string, unknown>) => ({
        eq: async () => {
          writes.push({ table, value });
          return { error: null };
        },
      }),
    }),
  } as unknown as ConstructorParameters<typeof DiscoveryStore>[0];
  const store = new DiscoveryStore(db);
  const state = {
    source: 'github' as const,
    initialized_at: CUTOFF,
    last_success_at: CUTOFF,
    seen_keys: [digest('example/already-seen')],
  };
  const now = '2026-09-13T12:00:00Z';
  await assert.rejects(store.commit(snapshot, state, now), /Incomplete/);
  const saved = await store.commitPartial(snapshot, state, now);
  assert.equal(saved.newCandidates, 1);
  assert.deepEqual(
    writes.map((write) => write.table),
    ['discovery_candidates', 'discovery_sources'],
  );
  assert.equal((writes[0]!.value as unknown[]).length, 1);
  const progress = writes[1]!.value as Record<string, unknown>;
  assert.equal('last_success_at' in progress, false);
  assert.equal('initialized_at' in progress, false);
  assert.deepEqual(progress.seen_keys, [
    digest('example/already-seen'),
    digest('example/found'),
  ]);

  const retry = await githubSnapshot(
    Date.now() + 60_000,
    new Set(progress.seen_keys as string[]),
    state.last_success_at,
    async (url) => {
      assert.match(
        new URL(url).searchParams.get('q')!,
        /created:>=2026-09-10T04:00:00Z/,
      );
      return {
        total_count: 2,
        incomplete_results: false,
        items: [repository('found'), repository('previously-omitted')],
      };
    },
  );
  assert.equal(retry.complete, true);
  assert.deepEqual(
    retry.items.map((item) => item.id),
    ['example/previously-omitted'],
  );
});

void test('A missing GitHub completion flag cannot advance a checkpoint', async () => {
  const snapshot = await githubSnapshot(
    Date.now() + 60_000,
    new Set(),
    CUTOFF,
    async () => ({ total_count: 1, items: [repository('found')] }),
  );
  assert.equal(snapshot.complete, false);
  assert.match(snapshot.error ?? '', /incomplete_results/);
});
