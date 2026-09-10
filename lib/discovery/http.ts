import robotsParser from 'robots-parser';
import { readPublic } from '../server/public-reader.ts';

const AGENT = 'RUAGENTIC-Directory'; // matches the pinned public reader's HTTP User-Agent
const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();
export class ProviderError extends Error {
  provider: string;
  status: number;
  code?: string;
  constructor(provider: string, status: number, code?: string) {
    super(`${provider} returned HTTP ${status}${code ? ` (${code})` : ''}`);
    this.provider = provider;
    this.status = status;
    this.code = code;
  }
}
/** No browser sessions, private endpoints, or credentials are used for public crawling. */
export async function readPage(
  url: string,
  deadline: number,
  robots = true,
  limit = 5_000_000,
) {
  const u = new URL(url);
  if (robots) {
    let rules = robotsCache.get(u.origin);
    if (!rules) {
      const record = await readPublic(
        `${u.origin}/robots.txt`,
        2_000_000,
        deadline,
      );
      if (
        record.status === 429 ||
        record.status >= 500 ||
        [401, 403].includes(record.status)
      )
        throw new ProviderError(u.hostname, record.status);
      if (![200, 404, 410].includes(record.status))
        throw new Error(`${u.hostname}: robots.txt could not be checked`);
      rules = robotsParser(
        `${u.origin}/robots.txt`,
        record.status === 200 ? record.text : '',
      );
      robotsCache.set(u.origin, rules);
    }
    if (rules.isAllowed(url, AGENT) === false)
      throw new Error(`${u.hostname}: robots.txt disallows this path`);
  }
  const result = await readPublic(url, limit, deadline, {
    allowQuery: true,
    timeoutMs: 20000,
  });
  if (result.status !== 200) throw new ProviderError(u.hostname, result.status);
  return result;
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
    throw new ProviderError(u.hostname, response.status, code);
  }
  return JSON.parse(body);
}
export function resetRobotsCache() {
  robotsCache.clear();
}
