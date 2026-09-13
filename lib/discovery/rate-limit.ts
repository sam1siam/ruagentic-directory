import { setTimeout as delay } from 'node:timers/promises';

type Clock = { now: () => number; sleep: (ms: number) => Promise<unknown> };
type Bucket = {
  next: number;
  interval: number;
  blocked: number;
  dailyLeft?: number;
  minuteLeft?: number;
  remaining?: number;
};

/** Thrown when a provider stays blocked for longer than the job has left. */
export class ProviderCooldown extends Error {
  provider: string;
  seconds: number;
  constructor(provider: string, seconds: number) {
    super(
      `${provider} provider cooldown exceeds job deadline; retry in about ${Math.max(1, Math.ceil(seconds / 60))} min`,
    );
    this.provider = provider;
    this.seconds = seconds;
  }
}

/** Paces provider calls, including empty searches and
 *  failures, and adapts to their rate-limit headers. Never retries writes. */
export class ProviderPacer {
  private buckets = new Map<string, Bucket>();
  private githubBlocked = 0;
  private clock: Clock;
  constructor(clock: Clock = { now: Date.now, sleep: delay }) {
    this.clock = clock;
  }
  private key(url: URL) {
    if (url.hostname === 'api.prospeo.io')
      return `prospeo:${url.pathname.startsWith('/search-') ? 'search' : 'enrich'}`;
    if (url.hostname === 'app.findymail.com') return 'findymail';
    if (url.hostname === 'server.smartlead.ai') return 'smartlead';
    if (url.hostname === 'api.github.com')
      return url.pathname.startsWith('/search/')
        ? 'github:search'
        : 'github:core';
    return undefined;
  }
  private bucket(key: string) {
    let b = this.buckets.get(key);
    if (!b) {
      // GitHub search allows 10 requests a minute without a token, 30 with one.
      const interval = key.startsWith('prospeo:')
        ? 3100
        : key === 'github:search'
          ? process.env.GITHUB_TOKEN
            ? 2100
            : 6500
          : key === 'github:core'
            ? 750
            : 1100;
      b = { next: 0, interval, blocked: 0 };
      this.buckets.set(key, b);
    }
    return b;
  }
  async wait(url: URL, deadline: number) {
    const key = this.key(url);
    if (!key) return;
    const b = this.bucket(key);
    let at = Math.max(this.clock.now(), b.next);
    for (;;) {
      const now = this.clock.now();
      const blocked = Math.max(
        b.blocked,
        key.startsWith('github:') ? this.githubBlocked : 0,
      );
      // Another response can extend the cooldown while this caller sleeps.
      if (blocked > at) at = Math.max(blocked, b.next);
      if (at > deadline - 20_000)
        throw new ProviderCooldown(key, Math.ceil((at - now) / 1000));
      b.next = Math.max(b.next, at + b.interval);
      if (at <= now) return;
      await this.clock.sleep(at - now);
    }
  }
  observe(url: URL, headers: Headers, status: number, secondaryLimit = false) {
    const key = this.key(url);
    if (!key) return 0;
    const b = this.bucket(key),
      now = this.clock.now();
    const number = (name: string) => {
      const value = headers.get(name);
      return value !== null && Number.isFinite(Number(value))
        ? Number(value)
        : undefined;
    };
    if (key.startsWith('prospeo:')) {
      const second = number('x-second-rate-limit'),
        minute = number('x-minute-rate-limit');
      if (second && minute)
        b.interval = Math.max(
          1100,
          Math.ceil(1000 / second) + 100,
          Math.ceil(60000 / minute) + 100,
        );
      b.dailyLeft = number('x-daily-request-left') ?? b.dailyLeft;
      b.minuteLeft = number('x-minute-request-left') ?? b.minuteLeft;
      for (const period of ['minute', 'daily']) {
        if (number(`x-${period}-request-left`) === 0) {
          const seconds =
            number(`x-${period}-reset-seconds`) ??
            (period === 'daily' ? 86400 : 60);
          b.blocked = Math.max(b.blocked, now + seconds * 1000 + 1000);
        }
      }
    }
    if (key.startsWith('github:')) {
      const remaining = number('x-ratelimit-remaining'),
        reset = number('x-ratelimit-reset');
      b.remaining = remaining ?? b.remaining;
      if (remaining === 0 && reset)
        b.blocked = Math.max(b.blocked, reset * 1000 + 1000);
    }
    const githubSecondary =
      key.startsWith('github:') &&
      (secondaryLimit ||
        ((status === 403 || status === 429) &&
          number('x-ratelimit-remaining') !== 0 &&
          (status === 429 || headers.has('retry-after'))));
    if (
      status === 429 ||
      githubSecondary ||
      (key.startsWith('github:') &&
        status === 403 &&
        headers.has('retry-after'))
    ) {
      const retry = headers.get('retry-after');
      const milliseconds =
        retry && /^\d+(?:\.\d+)?$/.test(retry)
          ? Number(retry) * 1000
          : retry
            ? Date.parse(retry) - now
            : 60000;
      b.blocked = Math.max(
        b.blocked,
        now +
          (Number.isFinite(milliseconds)
            ? Math.max(1000, milliseconds)
            : 60000) +
          1000,
      );
      // Secondary limits apply across GitHub's search and core endpoints.
      if (githubSecondary)
        this.githubBlocked = Math.max(this.githubBlocked, b.blocked);
    }
    return Math.max(0, Math.ceil((b.blocked - now) / 1000));
  }
  /** Per-provider state for the run report. */
  snapshot() {
    const now = this.clock.now();
    return Object.fromEntries(
      [...this.buckets].map(([key, b]) => [
        key,
        {
          intervalMs: b.interval,
          blockedForSeconds: Math.max(
            0,
            Math.ceil(
              (Math.max(
                b.blocked,
                key.startsWith('github:') ? this.githubBlocked : 0,
              ) -
                now) /
                1000,
            ),
          ),
          ...(b.dailyLeft !== undefined ? { dailyLeft: b.dailyLeft } : {}),
          ...(b.minuteLeft !== undefined ? { minuteLeft: b.minuteLeft } : {}),
          ...(b.remaining !== undefined ? { remaining: b.remaining } : {}),
        },
      ]),
    );
  }
}

export const providerPacer = new ProviderPacer();
