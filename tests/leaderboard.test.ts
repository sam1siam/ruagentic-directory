import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compact,
  githubRepo,
  rankListings,
  refreshOrder,
  type ListingMetrics,
} from '../lib/leaderboard.ts';
import { emptyListing, type PublicListing } from '../lib/listing.ts';

const listing = (slug: string, kind: string, repo = ''): PublicListing => ({
  ...emptyListing,
  kind: kind as PublicListing['kind'],
  name: slug.toUpperCase(),
  summary: 'A summary that is long enough.',
  description: 'A description that is long enough to satisfy the schema.',
  homepage: 'https://example.com/' + slug,
  repository: repo,
  slug,
  source: 'test',
  sourceUrl: 'https://example.com',
  observedAt: '2026-10-01',
  publishedAt: '',
});
const metric = (
  slug: string,
  stars: number,
  extra: Partial<ListingMetrics> = {},
): ListingMetrics => ({
  slug,
  repository: 'https://github.com/x/' + slug,
  stars,
  forks: 0,
  watchers: 0,
  open_issues: 0,
  pushed_at: null,
  fetched_at: '2026-10-01T10:00:00Z',
  error: null,
  ...extra,
});

void test('GitHub repositories are read from listing URLs only', () => {
  assert.equal(githubRepo('https://github.com/Acme/Tool.git'), 'acme/tool');
  assert.equal(
    githubRepo('https://github.com/acme/tool/tree/main/x'),
    'acme/tool',
  );
  assert.equal(githubRepo('https://gitlab.com/acme/tool'), undefined);
  assert.equal(githubRepo('https://github.com/acme'), undefined);
  assert.equal(githubRepo(''), undefined);
});
void test('Ranking uses stars, then forks, then name, and only listings with metrics', () => {
  const listings = [
    listing('a', 'server', 'https://github.com/x/a'),
    listing('b', 'server', 'https://github.com/x/b'),
    listing('c', 'server', 'https://github.com/x/c'),
    listing('d', 'client', 'https://github.com/x/d'),
    listing('e', 'server', 'https://github.com/x/e'),
  ];
  const metrics = [
    metric('a', 10),
    metric('b', 50, { forks: 2 }),
    metric('c', 50, { forks: 5 }),
    metric('d', 500),
    metric('e', 999, { error: 'not found' }),
  ];
  assert.deepEqual(
    rankListings(listings, metrics, 'server').map((r) => [r.rank, r.slug]),
    [
      [1, 'c'],
      [2, 'b'],
      [3, 'a'],
    ],
  );
  assert.deepEqual(
    rankListings(listings, metrics).map((r) => r.slug),
    ['d', 'c', 'b', 'a'],
  );
  assert.equal(rankListings(listings, metrics, undefined, 2).length, 2);
});
void test('Refresh takes never-collected repositories first, then the oldest', () => {
  const listings = [
    listing('old', 'server', 'https://github.com/x/old'),
    listing('new', 'server', 'https://github.com/x/new'),
    listing('none', 'server', 'https://github.com/x/none'),
    listing('nohub', 'server', 'https://gitlab.com/x/nohub'),
  ];
  const metrics = [
    metric('old', 1, { fetched_at: '2026-09-01T00:00:00Z' }),
    metric('new', 1, { fetched_at: '2026-10-01T00:00:00Z' }),
  ];
  assert.deepEqual(
    refreshOrder(listings, metrics, 10).map((r) => r.repo),
    ['x/none', 'x/old', 'x/new'],
  );
  assert.equal(refreshOrder(listings, metrics, 1).length, 1);
});
void test('Counts are shown compactly', () => {
  assert.equal(compact(999), '999');
  assert.equal(compact(1500), '1.5k');
  assert.equal(compact(12000), '12k');
  assert.equal(compact(2_300_000), '2.3M');
});

void test('Listings that share a repository collapse into one row', () => {
  const listings = [
    listing('ecs', 'server', 'https://github.com/aws/mcp'),
    listing('eks', 'server', 'https://github.com/aws/mcp'),
    listing('solo', 'server', 'https://github.com/x/solo'),
  ];
  const metrics = [metric('ecs', 100), metric('eks', 100), metric('solo', 50)];
  const rows = rankListings(listings, metrics, 'server');
  assert.deepEqual(
    rows.map((r) => [r.rank, r.slug, r.siblings]),
    [
      [1, 'ecs', 1],
      [2, 'solo', 0],
    ],
  );
});
