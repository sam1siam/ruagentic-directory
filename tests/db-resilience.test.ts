import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBreaker,
  newestFirst,
  timedFetch,
} from '../lib/db-resilience.ts';

// A fetch that never answers until its signal aborts.
const hanging = ((_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
  })) as typeof fetch;

await test('a slow database request gives up after the time limit', async () => {
  // AbortSignal.timeout does not keep Node alive; this timer does, so the
  // runner does not finish while the request is still pending.
  const keepAlive = setTimeout(() => {}, 5000);
  const started = Date.now();
  await assert.rejects(timedFetch(50, hanging)('https://db.example/rest'), {
    name: 'TimeoutError',
  });
  clearTimeout(keepAlive);
  assert.ok(Date.now() - started < 2000);
});

await test("the caller's own abort still works", async () => {
  const controller = new AbortController();
  const pending = timedFetch(60_000, hanging)('https://db.example/rest', {
    signal: controller.signal,
  });
  controller.abort(new Error('caller stopped'));
  await assert.rejects(pending, /caller stopped/);
});

await test('after a failure the database is skipped for the cool-down', () => {
  let now = 1_000;
  const breaker = createBreaker(30_000, () => now);
  assert.equal(breaker.isOpen(), false);
  breaker.trip();
  assert.equal(breaker.isOpen(), true);
  now += 29_999;
  assert.equal(breaker.isOpen(), true);
  now += 1;
  assert.equal(breaker.isOpen(), false);
  breaker.trip();
  breaker.reset();
  assert.equal(breaker.isOpen(), false);
});

await test('rows keep the newest-first, then slug, order', () => {
  const rows = [
    { slug: 'b', updatedAt: '2026-10-01T00:00:00+00:00' },
    { slug: 'c', updatedAt: '2026-11-01T00:00:00+00:00' },
    { slug: 'a', updatedAt: '2026-10-01T00:00:00+00:00' },
  ];
  assert.deepEqual(
    rows.sort(newestFirst).map((r) => r.slug),
    ['c', 'a', 'b'],
  );
});
