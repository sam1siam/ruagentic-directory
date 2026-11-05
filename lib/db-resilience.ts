/** Guards for database reads. A slow database must fail a request quickly
 *  rather than hold a Vercel function until its limit, and a failing one
 *  must not be asked again by every request while it recovers. Pure, so
 *  the behaviour is testable without a database. */

/** A fetch that gives up after `ms`, keeping any caller's own signal. */
export function timedFetch(ms: number, base: typeof fetch = fetch) {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const timeout = AbortSignal.timeout(ms);
    return base(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    });
  }) as typeof fetch;
}

/** After a failure, reads skip the database for `coolDownMs`. */
export function createBreaker(coolDownMs: number, now = () => Date.now()) {
  let openUntil = 0;
  return {
    isOpen: () => now() < openUntil,
    trip: () => {
      openUntil = now() + coolDownMs;
    },
    reset: () => {
      openUntil = 0;
    },
  };
}

/** Most recently updated first, then by slug: the order the catalog has
 *  always had, now applied after reading so the query can use the
 *  primary key instead of sorting the whole table. */
export function newestFirst(
  a: { slug: string; updatedAt: string },
  b: { slug: string; updatedAt: string },
) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
