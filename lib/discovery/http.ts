import robotsParser from 'robots-parser';
import { readPublic } from '../server/public-reader.ts';
import { ProviderCooldown, providerPacer } from './rate-limit.ts';

export { ProviderCooldown } from './rate-limit.ts';

const AGENT = 'RUAGENTIC-Directory'; // matches the pinned public reader's HTTP User-Agent
const MAX_REDIRECTS = 5;
const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();
type Reader = typeof readPublic;
export class ProviderError extends Error {
  provider: string;
  status: number;
  code?: string;
  retryAfterSeconds: number;
  constructor(
    provider: string,
    status: number,
    code?: string,
    retryAfterSeconds = 0,
  ) {
    super(`${provider} returned HTTP ${status}${code ? ` (${code})` : ''}`);
    this.provider = provider;
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
const PAID_PROVIDERS = new Set([
  'api.prospeo.io',
  'app.findymail.com',
  'server.smartlead.ai',
  'api.github.com',
]);
/** Rate limits, cooldowns and account problems at a paid provider or the
 *  GitHub API are not a candidate's fault: callers put the candidate back
 *  instead of failing it. */
export function providerHold(error: unknown) {
  return (
    error instanceof ProviderCooldown ||
    (error instanceof ProviderError &&
      PAID_PROVIDERS.has(error.provider) &&
      [401, 402, 403, 423, 429].includes(error.status))
  );
}
/** The next hop of a redirect: HTTPS only, no credentials, fragment dropped. */
export function redirectTarget(from: URL, location: string | undefined) {
  if (!location) return;
  try {
    const next = new URL(location, from);
    if (next.protocol !== 'https:' || next.username || next.password) return;
    next.hash = '';
    return next;
  } catch {
    return;
  }
}
/** RFC 9309: follow up to five redirects; a 4xx or a redirect that cannot be
 *  followed means no restrictions; 429, 5xx, 401 and 403 stop the read. */
async function robotsText(origin: string, deadline: number, reader: Reader) {
  let current = new URL('/robots.txt', origin);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const record = await reader(current.href, 2_000_000, deadline, {
      allowQuery: true,
      redirects: 'return',
    });
    if (record.status >= 300 && record.status < 400) {
      const next = redirectTarget(current, record.location);
      if (!next) return '';
      current = next;
      continue;
    }
    if (
      record.status === 429 ||
      record.status >= 500 ||
      [401, 403].includes(record.status)
    )
      throw new ProviderError(current.hostname, record.status);
    return record.status === 200 ? record.text : '';
  }
  return '';
}
async function checkRobots(url: URL, deadline: number, reader: Reader) {
  let rules = robotsCache.get(url.origin);
  if (!rules) {
    rules = robotsParser(
      `${url.origin}/robots.txt`,
      await robotsText(url.origin, deadline, reader),
    );
    robotsCache.set(url.origin, rules);
  }
  if (rules.isAllowed(url.href, AGENT) === false)
    throw new Error(`${url.hostname}: robots.txt disallows this path`);
}
/** No browser sessions, private endpoints, or credentials are used for public
 *  crawling. Redirects are followed for up to five hops; the reader resolves
 *  and pins every hop to public addresses again, every hop must stay on HTTPS,
 *  and each is checked against the robots.txt of its own origin. */
export async function readPage(
  url: string,
  deadline: number,
  robots = true,
  limit = 5_000_000,
  reader: Reader = readPublic,
) {
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (robots) await checkRobots(current, deadline, reader);
    const result = await reader(current.href, limit, deadline, {
      allowQuery: true,
      timeoutMs: 20000,
      redirects: 'return',
    });
    if (result.status >= 300 && result.status < 400) {
      const next = redirectTarget(current, result.location);
      if (!next)
        throw new Error(
          `${current.hostname}: redirect without a usable HTTPS location`,
        );
      current = next;
      continue;
    }
    if (result.status !== 200)
      throw new ProviderError(current.hostname, result.status);
    return { ...result, url: current.href };
  }
  throw new Error(
    `${new URL(url).hostname}: more than ${MAX_REDIRECTS} redirects`,
  );
}
/** Authenticated APIs have fixed provider origins and never redirect credentials. */
export async function apiJson(
  url: string,
  init: RequestInit = {},
  deadline = Date.now() + 20_000,
): Promise<unknown> {
  const allowed = new Set([
    'api.prospeo.io',
    'app.findymail.com',
    'server.smartlead.ai',
    'api.github.com',
    'api.producthunt.com',
  ]);
  const u = new URL(url);
  if (
    u.protocol !== 'https:' ||
    !allowed.has(u.hostname) ||
    u.username ||
    u.password
  )
    throw new Error('Unsupported API origin');
  await providerPacer.wait(u, deadline);
  const timeout = Math.min(20_000, deadline - Date.now());
  if (timeout <= 0) throw new Error('Job deadline reached');
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(u, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(timeout),
    headers,
  });
  const retryAfterSeconds = providerPacer.observe(
    u,
    response.headers,
    response.status,
  );
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error('API response exceeded limit');
  if (!response.ok) {
    let code;
    try {
      const v = JSON.parse(body);
      if (
        typeof v.error_code === 'string' &&
        /^[A-Z_]{2,50}$/.test(v.error_code)
      )
        code = v.error_code;
    } catch {}
    throw new ProviderError(
      u.hostname,
      response.status,
      code,
      retryAfterSeconds,
    );
  }
  return JSON.parse(body);
}
export function resetRobotsCache() {
  robotsCache.clear();
}
