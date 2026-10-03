import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareListings,
  listingDetail,
  newListings,
  overview,
  relevance,
  searchListings,
} from '../lib/finder.ts';
import {
  claudeCodeCommand,
  clientTarget,
  serverConfigFor,
} from '../lib/connect-clients.ts';
import { emptyListing, type PublicListing } from '../lib/listing.ts';

const now = Date.parse('2026-10-02T12:00:00Z');
const base = (over: Partial<PublicListing>): PublicListing => ({
  ...emptyListing,
  name: 'Listing',
  summary: 'A summary that is long enough to pass.',
  description: 'A description that is long enough to satisfy the schema rules.',
  homepage: 'https://example.com',
  category: 'Developer tools',
  slug: 'listing',
  source: 'test',
  sourceUrl: 'https://example.com',
  observedAt: '2026-09-01',
  publishedAt: '',
  ...over,
});
const items = [
  base({
    slug: 'postgres-mcp',
    name: 'Postgres MCP',
    kind: 'server',
    summary: 'Query PostgreSQL databases through MCP.',
    tags: ['postgres', 'database'],
    category: 'Data & intelligence',
    endpoint: 'https://db.example/mcp',
    authentication: 'api-key',
    remotes: [{ type: 'streamable-http', url: 'https://db.example/mcp' }],
  }),
  base({
    slug: 'pg-skill',
    name: 'PG Tuning Skill',
    kind: 'skill',
    summary: 'Teaches an agent to tune Postgres queries.',
    tags: ['skill', 'postgres'],
    platforms: ['Claude Code'],
    agenticCheckedAt: '2026-09-20T00:00:00Z',
    observedAt: '2026-10-01',
  }),
  base({
    slug: 'image-agent',
    name: 'Image Agent',
    kind: 'product',
    summary: 'Generates images for marketing teams.',
    tags: ['images'],
    category: 'Media, audio & video',
  }),
];
const metrics = new Map([
  [
    'postgres-mcp',
    { stars: 1200, forks: 40, createdAt: '2026-08-01T00:00:00Z' },
  ],
  ['pg-skill', { stars: 30, forks: 2, createdAt: '2026-09-25T00:00:00Z' }],
]);

void test('Relevance favours names, then tags, summary and body', () => {
  assert.ok(
    relevance(items[0]!, 'postgres') > relevance(items[1]!, 'postgres'),
  );
  assert.equal(relevance(items[2]!, 'postgres'), 0);
  assert.equal(relevance(items[2]!, ''), 1);
});
void test('Search filters by kind, stars, launch window, verification and platform', () => {
  const all = searchListings(items, metrics, { query: 'postgres' }, now);
  assert.deepEqual(
    all.listings.map((l) => l.slug),
    ['postgres-mcp', 'pg-skill'],
  );
  assert.equal(all.listings[0]!.stars, 1200);
  assert.equal(
    all.listings[0]!.url,
    'https://ruagentic.com/tools/postgres-mcp',
  );
  assert.deepEqual(
    searchListings(
      items,
      metrics,
      { query: 'postgres', kind: 'skill' },
      now,
    ).listings.map((l) => l.slug),
    ['pg-skill'],
  );
  assert.deepEqual(
    searchListings(
      items,
      metrics,
      { query: 'postgres', minStars: 1000 },
      now,
    ).listings.map((l) => l.slug),
    ['postgres-mcp'],
  );
  assert.deepEqual(
    searchListings(
      items,
      metrics,
      { query: 'postgres', launched: '30d' },
      now,
    ).listings.map((l) => l.slug),
    ['pg-skill'],
  );
  assert.deepEqual(
    searchListings(
      items,
      metrics,
      { query: 'postgres', verifiedOnly: true },
      now,
    ).listings.map((l) => l.slug),
    ['pg-skill'],
  );
  assert.deepEqual(
    searchListings(
      items,
      metrics,
      { platform: 'claude code' },
      now,
    ).listings.map((l) => l.slug),
    ['pg-skill'],
  );
  // No query: everything, most stars first; unknown stars last.
  assert.deepEqual(
    searchListings(items, metrics, {}, now).listings.map((l) => l.slug),
    ['postgres-mcp', 'pg-skill', 'image-agent'],
  );
  const paged = searchListings(items, metrics, { limit: 1 }, now);
  assert.equal(paged.total, 3);
  assert.equal(paged.nextOffset, 1);
});
void test('Listing detail carries connect facts, the CLI command and the Q&A', () => {
  const d = listingDetail(items[0]!, metrics.get('postgres-mcp'));
  assert.equal(d.connect.remote?.url, 'https://db.example/mcp');
  assert.equal(d.connect.cli, 'npx ruagentic add postgres-mcp');
  assert.ok(d.connect.snippets.length > 0);
  assert.ok(d.faq.some((f) => f.q === 'How do I connect to Postgres MCP?'));
  assert.equal(d.stars, 1200);
  assert.equal(listingDetail(items[1]!).connect.cli, null);
});
void test('Compare, overview and new listings read stored facts only', () => {
  const rows = compareListings([items[0]!, items[1]!], metrics);
  assert.deepEqual(
    rows.map((r) => [r.slug, r.stars, r.authentication]),
    [
      ['postgres-mcp', 1200, 'api-key'],
      ['pg-skill', 30, 'unknown'],
    ],
  );
  const o = overview(items);
  assert.equal(o.total, 3);
  assert.equal(o.kinds.find((k) => k.kind === 'skill')?.count, 1);
  assert.equal(
    o.categories.find((c) => c.name === 'Developer tools')?.count,
    1,
  );
  assert.deepEqual(
    newListings(items, metrics, 7, undefined, 20, now).map((l) => l.slug),
    ['pg-skill'],
  );
  assert.deepEqual(newListings(items, metrics, 7, 'server', 20, now), []);
});
void test('Client configs come from the published remote or package', () => {
  assert.deepEqual(
    serverConfigFor({
      remote: { url: 'https://db.example/mcp', type: 'streamable-http' },
      package: null,
      requiredEnv: [],
    }),
    { url: 'https://db.example/mcp' },
  );
  assert.deepEqual(
    serverConfigFor({
      remote: null,
      package: { registryType: 'npm', identifier: '@x/mcp', version: '1' },
      requiredEnv: ['TOKEN'],
    }),
    { command: 'npx', args: ['-y', '@x/mcp'], env: { TOKEN: '<value>' } },
  );
  assert.equal(
    serverConfigFor({ remote: null, package: null, requiredEnv: [] }),
    null,
  );
  assert.equal(clientTarget('codex').kind, 'toml');
  assert.equal(clientTarget('claude-code').kind, 'command');
  assert.equal(
    claudeCodeCommand(
      'db',
      { url: 'https://db.example/mcp' },
      'streamable-http',
    ),
    'claude mcp add --transport http db https://db.example/mcp',
  );
});
