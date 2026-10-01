import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProviderCooldown,
  ProviderPacer,
} from '../lib/discovery/rate-limit.ts';
import { apiJson } from '../lib/discovery/http.ts';

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
