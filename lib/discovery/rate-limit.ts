import { setTimeout as delay } from 'node:timers/promises';

type Clock = { now: () => number; sleep: (ms: number) => Promise<unknown> };
type Bucket = {
  next: number;
  interval: number;
  blocked: number;
  dailyLeft?: number;
  minuteLeft?: number;
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

/** Paces every Prospeo and Findymail call, including empty searches and
 *  failures, and adapts to their rate-limit headers. Never retries writes. */
export class ProviderPacer {
  private buckets = new Map<string, Bucket>();
  private clock: Clock;
  constructor(clock: Clock = { now: Date.now, sleep: delay }) {
    this.clock = clock;
  }
  private key(url: URL) {
    return url.hostname === 'api.prospeo.io'
      ? `prospeo:${url.pathname.startsWith('/search-') ? 'search' : 'enrich'}`
      : url.hostname === 'app.findymail.com'
        ? 'findymail'
        : undefined;
  }
  private bucket(key: string) {
    let b = this.buckets.get(key);
    if (!b) {
      b = {
        next: 0,
        interval: key.startsWith('prospeo:') ? 3100 : 1100,
        blocked: 0,
      };
      this.buckets.set(key, b);
    }
    return b;
  }
  async wait(url: URL, deadline: number) {
    const key = this.key(url);
    if (!key) return;
    const b = this.bucket(key),
      now = this.clock.now();
    const at = Math.max(now, b.next, b.blocked);
    if (at > deadline - 20_000)
      throw new ProviderCooldown(key, Math.ceil((at - now) / 1000));
    b.next = at + b.interval; // reserve before awaiting, so concurrent callers cannot burst
    if (at > now) await this.clock.sleep(at - now);
  }
  observe(url: URL, headers: Headers, status: number) {
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
    if (status === 429) {
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
          blockedForSeconds: Math.max(0, Math.ceil((b.blocked - now) / 1000)),
          ...(b.dailyLeft !== undefined ? { dailyLeft: b.dailyLeft } : {}),
          ...(b.minuteLeft !== undefined ? { minuteLeft: b.minuteLeft } : {}),
        },
      ]),
    );
  }
}

export const providerPacer = new ProviderPacer();
