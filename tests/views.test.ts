import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateViews, isBot, validSlug } from '../lib/views.ts';

void test('View totals cover the last 7 days, 30 days and all time per listing', () => {
  const totals = aggregateViews(
    [
      { slug: 'a', day: '2026-10-02', views: 5 },
      { slug: 'a', day: '2026-09-26', views: 2 }, // 6 days ago: in the week
      { slug: 'a', day: '2026-09-25', views: 3 }, // 7 days ago: month only
      { slug: 'a', day: '2026-09-02', views: 7 }, // 30 days ago: all time only
      { slug: 'b', day: '2026-10-01', views: 1 },
    ],
    '2026-10-02',
  );
  assert.deepEqual(totals.get('a'), { week: 7, month: 10, total: 17 });
  assert.deepEqual(totals.get('b'), { week: 1, month: 1, total: 1 });
  assert.equal(totals.get('c'), undefined);
});
void test('Crawlers and bad slugs are not counted', () => {
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot('curl/8.0'), true);
  assert.equal(isBot(null), true);
  assert.equal(
    isBot(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130',
    ),
    false,
  );
  assert.equal(validSlug('github-mcp'), true);
  assert.equal(validSlug('GitHub'), false);
  assert.equal(validSlug('../x'), false);
  assert.equal(validSlug(42), false);
});
