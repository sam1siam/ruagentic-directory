import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFilterCount,
  defaultFilters,
  filtersFromParams,
  matchesFilters,
  orderListings,
  paramsFromFilters,
  toBrowserListing,
  topPlatforms,
  type CatalogListing,
} from '../lib/browse.ts';
import { emptyListing, type PublicListing } from '../lib/listing.ts';

const now = Date.parse('2026-10-02T00:00:00Z');
const base: PublicListing = {
  ...emptyListing,
  name: 'Example',
  summary: 'An example listing summary.',
  description: 'An example listing description that is long enough to pass.',
  homepage: 'https://example.com',
  slug: 'example',
  source: 'test',
  sourceUrl: 'https://example.com',
  observedAt: '2026-09-01',
  publishedAt: '',
};
const item = (over: Partial<CatalogListing>): CatalogListing => ({
  ...toBrowserListing(base),
  ...over,
});

void test('Browser listings carry metrics when collected and nulls when not', () => {
  const bare = toBrowserListing(base);
  assert.equal(bare.stars, null);
  assert.equal(bare.launchedAt, null);
  assert.equal(bare.verified, false);
  const rich = toBrowserListing(
    { ...base, agenticCheckedAt: '2026-09-20T00:00:00Z' },
    { stars: 120, forks: 4, createdAt: '2026-09-15T00:00:00Z' },
  );
  assert.equal(rich.stars, 120);
  assert.equal(rich.launchedAt, '2026-09-15T00:00:00Z');
  assert.equal(rich.verified, true);
});
void test('Launch, stars, forks, pricing, verified and platform filters apply together', () => {
  const young = item({
    slug: 'young',
    stars: 2500,
    forks: 30,
    launchedAt: '2026-09-20T00:00:00Z',
    pricing: 'open-source',
    verified: true,
    platforms: ['Claude Code', 'Cursor'],
  });
  const old = item({
    slug: 'old',
    stars: 50,
    forks: 1,
    launchedAt: '2024-01-01T00:00:00Z',
    pricing: 'paid',
  });
  const undated = item({ slug: 'undated' });
  const f = { ...defaultFilters };
  assert.equal(matchesFilters(young, { ...f, launched: '30d' }, now), true);
  assert.equal(matchesFilters(old, { ...f, launched: '30d' }, now), false);
  assert.equal(matchesFilters(old, { ...f, launched: 'older' }, now), true);
  // An unknown launch date never passes a launch filter.
  assert.equal(matchesFilters(undated, { ...f, launched: 'year' }, now), false);
  assert.equal(matchesFilters(undated, f, now), true);
  assert.equal(matchesFilters(young, { ...f, stars: '1000' }, now), true);
  assert.equal(matchesFilters(old, { ...f, stars: '1000' }, now), false);
  assert.equal(matchesFilters(undated, { ...f, forks: '10' }, now), false);
  assert.equal(matchesFilters(old, { ...f, pricing: 'paid' }, now), true);
  assert.equal(matchesFilters(young, { ...f, verified: true }, now), true);
  assert.equal(matchesFilters(old, { ...f, verified: true }, now), false);
  assert.equal(matchesFilters(young, { ...f, platform: 'cursor' }, now), true);
  assert.equal(matchesFilters(old, { ...f, platform: 'cursor' }, now), false);
  assert.equal(
    matchesFilters(
      young,
      { ...f, launched: '90d', stars: '1000', verified: true },
      now,
    ),
    true,
  );
});
void test('Sorting by stars, forks and launch puts unknowns last', () => {
  const items = [
    item({ slug: 'b', name: 'B', stars: 10, forks: null, launchedAt: null }),
    item({
      slug: 'a',
      name: 'A',
      stars: null,
      forks: 5,
      launchedAt: '2026-01-01',
    }),
    item({
      slug: 'c',
      name: 'C',
      stars: 300,
      forks: 50,
      launchedAt: '2026-09-01',
    }),
  ];
  assert.deepEqual(
    orderListings(items, 'stars').map((i) => i.slug),
    ['c', 'b', 'a'],
  );
  assert.deepEqual(
    orderListings(items, 'forks').map((i) => i.slug),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(
    orderListings(items, 'launched').map((i) => i.slug),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(
    orderListings(items, 'name').map((i) => i.slug),
    ['a', 'b', 'c'],
  );
});
void test('Filters round-trip through the address and defaults stay out of it', () => {
  const f = filtersFromParams({
    launched: '90d',
    stars: '1000',
    verified: '1',
    sort: 'bogus',
    platform: 'Cursor',
  });
  assert.equal(f.launched, '90d');
  assert.equal(f.stars, '1000');
  assert.equal(f.verified, true);
  assert.equal(f.sort, 'name');
  assert.equal(
    paramsFromFilters(f).toString(),
    'launched=90d&stars=1000&verified=1&platform=Cursor',
  );
  assert.equal(paramsFromFilters(defaultFilters).toString(), '');
  assert.equal(
    paramsFromFilters(
      { ...defaultFilters, kind: 'skill' },
      { kind: 'skill' },
    ).toString(),
    '',
  );
  assert.equal(activeFilterCount(f), 4);
  assert.equal(activeFilterCount({ ...defaultFilters, q: '  ' }), 0);
});
void test('Top platforms are counted case-insensitively', () => {
  const items = [
    item({ slug: '1', platforms: ['Claude Code', 'cursor'] }),
    item({ slug: '2', platforms: ['Cursor'] }),
    item({ slug: '3', platforms: ['Zed'] }),
  ];
  assert.deepEqual(
    topPlatforms(items, 2).map((p) => [p.label, p.count]),
    [
      ['cursor', 2],
      ['Claude Code', 1],
    ],
  );
});
