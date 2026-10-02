/** The browser's listing model and its filters. Pure, shared by the client
 *  browser, the server pages that feed it and the unit tests. */
import type { PublicListing } from './listing.ts';

/** The subset of a listing the browser needs; keeps client payloads small. */
export type CatalogListing = {
  slug: string;
  name: string;
  kind: string;
  summary: string;
  category: string;
  homepage: string;
  tags: string[];
  source: string;
  observedAt: string;
  pricing: string;
  transport: string;
  authentication: string;
  platforms: string[];
  verified: boolean;
  /** Public GitHub figures from the metrics cron, when collected. */
  stars: number | null;
  forks: number | null;
  /** The repository's creation date: the only launch date the directory
   *  knows. Null for projects without a public GitHub repository. */
  launchedAt: string | null;
};
export type BrowserMetrics = {
  stars: number;
  forks: number;
  createdAt: string | null;
};
export const toBrowserListing = (
  listing: PublicListing,
  metrics?: BrowserMetrics,
): CatalogListing => ({
  slug: listing.slug,
  name: listing.name,
  kind: listing.kind,
  summary: listing.summary,
  category: listing.category,
  homepage: listing.homepage,
  tags: listing.tags,
  source: listing.source,
  observedAt: listing.observedAt,
  pricing: listing.pricing,
  transport: listing.transport,
  authentication: listing.authentication,
  platforms: listing.platforms,
  verified: Boolean(listing.agenticCheckedAt),
  stars: metrics?.stars ?? null,
  forks: metrics?.forks ?? null,
  launchedAt: metrics?.createdAt ?? null,
});

export const ALL_CATEGORIES = 'All categories';
export const LAUNCH_OPTIONS = [
  ['any', 'Any time'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['year', 'Last 12 months'],
  ['older', 'Older than a year'],
] as const;
export const STAR_OPTIONS = [
  ['any', 'Any'],
  ['100', '100+'],
  ['1000', '1k+'],
  ['10000', '10k+'],
] as const;
export const FORK_OPTIONS = [
  ['any', 'Any'],
  ['10', '10+'],
  ['100', '100+'],
  ['1000', '1k+'],
] as const;
export const PRICING_OPTIONS = [
  ['any', 'Any'],
  ['free', 'Free'],
  ['open-source', 'Open source'],
  ['freemium', 'Freemium'],
  ['paid', 'Paid'],
  ['contact', 'Pricing on request'],
] as const;
export const TRANSPORT_OPTIONS = [
  ['any', 'Any'],
  ['streamable-http', 'Streamable HTTP'],
  ['sse', 'SSE'],
  ['stdio', 'stdio'],
  ['multiple', 'Several'],
] as const;
export const AUTH_OPTIONS = [
  ['any', 'Any'],
  ['none', 'No credentials'],
  ['api-key', 'API key'],
  ['oauth', 'OAuth'],
  ['account', 'Account'],
] as const;
export const SORT_OPTIONS = [
  ['name', 'Name'],
  ['stars', 'Most stars'],
  ['forks', 'Most forks'],
  ['launched', 'Newest launch'],
  ['recent', 'Recently indexed'],
  ['kind', 'Type'],
] as const;
export type BrowseFilters = {
  q: string;
  kind: string;
  category: string;
  sort: string;
  launched: string;
  stars: string;
  forks: string;
  pricing: string;
  transport: string;
  auth: string;
  verified: boolean;
  platform: string;
};
export const defaultFilters: BrowseFilters = {
  q: '',
  kind: 'all',
  category: ALL_CATEGORIES,
  sort: 'name',
  launched: 'any',
  stars: 'any',
  forks: 'any',
  pricing: 'any',
  transport: 'any',
  auth: 'any',
  verified: false,
  platform: '',
};
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const pick = (
  value: string | undefined,
  options: readonly (readonly [string, string])[],
) => (options.some(([v]) => v === value) ? value! : options[0]![0]);
/** Filters from a page's search parameters; unknown values fall back. */
export function filtersFromParams(
  params: Record<string, string | string[] | undefined>,
): BrowseFilters {
  return {
    q: one(params.q) ?? '',
    kind: one(params.kind) ?? 'all',
    category: one(params.category) ?? ALL_CATEGORIES,
    sort: pick(one(params.sort), SORT_OPTIONS),
    launched: pick(one(params.launched), LAUNCH_OPTIONS),
    stars: pick(one(params.stars), STAR_OPTIONS),
    forks: pick(one(params.forks), FORK_OPTIONS),
    pricing: pick(one(params.pricing), PRICING_OPTIONS),
    transport: pick(one(params.transport), TRANSPORT_OPTIONS),
    auth: pick(one(params.auth), AUTH_OPTIONS),
    verified: one(params.verified) === '1',
    platform: one(params.platform) ?? '',
  };
}
/** The query string for a filter set, leaving defaults out so plain pages
 *  keep plain addresses. `lock` names filters the page fixes itself. */
export function paramsFromFilters(
  f: BrowseFilters,
  lock: { kind?: string; category?: string } = {},
) {
  const p = new URLSearchParams();
  for (const key of Object.keys(defaultFilters) as (keyof BrowseFilters)[]) {
    if ((key === 'kind' && lock.kind) || (key === 'category' && lock.category))
      continue;
    const value = f[key];
    if (value === defaultFilters[key]) continue;
    p.set(key, value === true ? '1' : String(value));
  }
  return p;
}
export function activeFilterCount(
  f: BrowseFilters,
  lock: { kind?: string; category?: string } = {},
) {
  return (Object.keys(defaultFilters) as (keyof BrowseFilters)[]).filter(
    (key) =>
      key !== 'sort' &&
      !(key === 'kind' && lock.kind) &&
      !(key === 'category' && lock.category) &&
      f[key] !== defaultFilters[key] &&
      !(key === 'q' && !String(f[key]).trim()),
  ).length;
}
const DAY = 86_400_000;
export function launchedWithin(
  launchedAt: string | null,
  option: string,
  now: number,
) {
  if (option === 'any') return true;
  if (!launchedAt) return false;
  const age = now - Date.parse(launchedAt);
  if (!Number.isFinite(age)) return false;
  return option === '30d'
    ? age <= 30 * DAY
    : option === '90d'
      ? age <= 90 * DAY
      : option === 'year'
        ? age <= 365 * DAY
        : age > 365 * DAY;
}
export const atLeast = (value: number | null, option: string) =>
  option === 'any' || (value !== null && value >= Number(option));
export function matchesFilters(
  item: CatalogListing,
  f: BrowseFilters,
  now = Date.now(),
) {
  const text = f.q.trim().toLowerCase();
  return (
    (f.kind === 'all' || item.kind === f.kind) &&
    (f.category === ALL_CATEGORIES || item.category === f.category) &&
    launchedWithin(item.launchedAt, f.launched, now) &&
    atLeast(item.stars, f.stars) &&
    atLeast(item.forks, f.forks) &&
    (f.pricing === 'any' || item.pricing === f.pricing) &&
    (f.transport === 'any' || item.transport === f.transport) &&
    (f.auth === 'any' || item.authentication === f.auth) &&
    (!f.verified || item.verified) &&
    (!f.platform ||
      item.platforms.some(
        (p) => p.toLowerCase() === f.platform.toLowerCase(),
      )) &&
    (!text ||
      [item.name, item.summary, ...item.tags]
        .join(' ')
        .toLowerCase()
        .includes(text))
  );
}
const num = (value: number | null) => value ?? -1;
export function orderListings(items: CatalogListing[], sort: string) {
  return [...items].sort((a, b) =>
    sort === 'stars'
      ? num(b.stars) - num(a.stars) || a.name.localeCompare(b.name)
      : sort === 'forks'
        ? num(b.forks) - num(a.forks) || a.name.localeCompare(b.name)
        : sort === 'launched'
          ? (b.launchedAt ?? '').localeCompare(a.launchedAt ?? '') ||
            a.name.localeCompare(b.name)
          : sort === 'recent'
            ? b.observedAt.localeCompare(a.observedAt) ||
              a.name.localeCompare(b.name)
            : sort === 'kind'
              ? a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
              : a.name.localeCompare(b.name),
  );
}
/** The most common platform names across the listings, for the sidebar. */
export function topPlatforms(items: CatalogListing[], limit = 8) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of items)
    for (const platform of item.platforms) {
      const key = platform.toLowerCase();
      const entry = counts.get(key) ?? { label: platform, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}
