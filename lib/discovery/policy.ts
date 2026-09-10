import { createHash } from 'node:crypto';
import { getDomain } from 'tldts';

export const CUTOFF = '2026-09-10T04:00:00.000Z'; // September 10, 00:00 America/Toronto
export const CAMPAIGN_ID = 3932154;
export const SOURCES = [
  'official-registry',
  'mcp-so',
  'pulsemcp',
  'cline',
  'docker',
  'cursor',
  'microsoft',
  'litellm',
  'producthunt',
] as const;
export type Source = (typeof SOURCES)[number];
export type Candidate = {
  source: Source;
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  homepage?: string;
  repository?: string;
  endpoint?: string;
  kind?: 'mcp-server' | 'mcp-client' | 'ai-agent';
  publishedAt?: string;
  dateEvidence?: string;
  founderName?: string;
  needsDetail?: boolean;
  registryUrl?: string;
  npmPackage?: string;
};
export type Snapshot = {
  source: Source;
  items: Candidate[];
  complete: boolean;
  error?: string;
};
export const digest = (s: string) =>
  createHash('sha256').update(s).digest('hex');
const shared = new Set([
  'github.com',
  'gitlab.com',
  'npmjs.com',
  'pypi.org',
  'docker.com',
  'producthunt.com',
  'mcp.so',
  'pulsemcp.com',
  'cursor.directory',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'readthedocs.io',
]);
export function publicUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2000) return;
  try {
    const u = new URL(value);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      /[{}<>\s]/.test(value) ||
      (u.port && u.port !== '443')
    )
      return;
    if (
      [...u.searchParams.keys()].some((k) =>
        /key|token|secret|signature|password|auth/i.test(k),
      )
    )
      return;
    u.hash = '';
    const parameterNames = Array.from(u.searchParams.keys());
    for (const k of parameterNames)
      if (/^utm_|^ref$|^source$/i.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    return u.href.replace(/\/$/, '');
  } catch {
    return;
  }
}
export function companyDomain(value: unknown): string | undefined {
  const u = publicUrl(value);
  if (!u) return;
  const host = new URL(u).hostname;
  const domain = getDomain(host, { allowPrivateDomains: true });
  if (
    !domain ||
    shared.has(domain) ||
    /(?:^|\.)(github\.io|vercel\.app|netlify\.app|pages\.dev|workers\.dev|readthedocs\.io)$/.test(
      host,
    )
  )
    return;
  return domain;
}
export function repositoryKey(value: unknown): string | undefined {
  const u = publicUrl(value);
  if (!u) return;
  const url = new URL(u),
    parts = url.pathname.split('/').filter(Boolean);
  if (!['github.com', 'gitlab.com'].includes(url.hostname) || parts.length < 2)
    return;
  return `${url.hostname}/${parts
    .slice(0, 2)
    .join('/')
    .replace(/\.git$/, '')
    .toLowerCase()}`;
}
export function aliases(
  item: Pick<Candidate, 'name' | 'repository' | 'homepage' | 'endpoint'>,
): string[] {
  return [
    ...new Set(
      [
        repositoryKey(item.repository)
          ? `repo:${repositoryKey(item.repository)}`
          : '',
        companyDomain(item.homepage)
          ? `domain:${companyDomain(item.homepage)}`
          : '',
        publicUrl(item.endpoint)
          ? `endpoint:${publicUrl(item.endpoint)!.toLowerCase()}`
          : '',
        `name:${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      ].filter((x) => x && x !== 'name:'),
    ),
  ];
}
export function qualify(item: Candidate): {
  eligible: boolean;
  reason: string;
} {
  if (!item.name.trim() || !publicUrl(item.sourceUrl))
    return {
      eligible: false,
      reason: 'Missing project identity or public source',
    };
  const text = `${item.name} ${item.description}`;
  if (/credential.harvest|malware|phishing kit|ransomware/i.test(text))
    return { eligible: false, reason: 'Excluded harmful product' };
  if (
    !item.kind &&
    !/\bMCP\b|model context protocol|\bAI agents?\b|\bagentic\b|autonomous agents?|coding agents?/i.test(
      text,
    )
  )
    return {
      eligible: false,
      reason: 'No evidence of an MCP server/client or AI agent',
    };
  if (
    !item.kind &&
    /\b(directory|catalog|newsletter|course|tutorial|prompt pack)\b/i.test(
      item.name,
    )
  )
    return {
      eligible: false,
      reason: 'Directory or content, not a listed product type',
    };
  if (![item.homepage, item.repository, item.endpoint].some(publicUrl))
    return {
      eligible: false,
      reason: 'Project homepage, repository, or endpoint is missing',
    };
  return { eligible: true, reason: item.kind ?? 'Documented agent product' };
}
/** Publication dates mean first listing publication, never sitemap lastmod or latest release. */
export function isNew(
  item: Candidate,
  known: Set<string>,
  initialized: boolean,
  now: string,
) {
  if (known.has(digest(item.id))) return false;
  if (item.publishedAt) {
    const t = Date.parse(item.publishedAt);
    return (
      Number.isFinite(t) &&
      t >= Date.parse(CUTOFF) &&
      t <= Date.parse(now) &&
      Boolean(item.dateEvidence)
    );
  }
  if (['official-registry', 'docker', 'producthunt'].includes(item.source))
    return false;
  return initialized; // absent from a previously completed, full source snapshot
}
export function validEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) &&
    !/[\r\n]/.test(value) &&
    !/^(?:no-?reply|do-?not-?reply|abuse|privacy|security|legal|postmaster|dmarc)@/i.test(
      value,
    )
  );
}
export function dayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
