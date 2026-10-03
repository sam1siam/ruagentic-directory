/** Pure search, detail and comparison logic behind the directory's MCP
 *  finder (the ChatGPT, Claude and Cursor app). Everything here works on
 *  stored listing facts and collected GitHub metrics; nothing is inferred. */
import {
  defaultFilters,
  matchesFilters,
  orderListings,
  toBrowserListing,
  type BrowseFilters,
  type BrowserMetrics,
  type CatalogListing,
} from './browse.ts';
import { categories, kinds } from './categories.ts';
import { connectPlan } from './connect.ts';
import { listingFaq } from './faq.ts';
import type { PublicListing } from './listing.ts';

export const SITE = 'https://ruagentic.com';
export type FinderSearch = {
  query?: string;
  kind?: string;
  category?: string;
  minStars?: number;
  launched?: 'any' | '30d' | '90d' | 'year' | 'older';
  verifiedOnly?: boolean;
  platform?: string;
  sort?: 'relevance' | 'stars' | 'newest' | 'name';
  limit?: number;
  offset?: number;
};
export type FinderRow = {
  slug: string;
  url: string;
  name: string;
  kind: string;
  kindLabel: string;
  category: string;
  summary: string;
  homepage: string;
  stars: number | null;
  launchedAt: string | null;
  verified: boolean;
  source: string;
};
const kindLabel = (kind: string) =>
  kinds.find((k) => k.kind === kind)?.singular ?? kind;
export const toRow = (l: CatalogListing): FinderRow => ({
  slug: l.slug,
  url: `${SITE}/tools/${l.slug}`,
  name: l.name,
  kind: l.kind,
  kindLabel: kindLabel(l.kind),
  category: l.category,
  summary: l.summary,
  homepage: l.homepage,
  stars: l.stars,
  launchedAt: l.launchedAt,
  verified: l.verified,
  source: l.source,
});
/** How well a listing matches the words of a query: name first, then tags,
 *  summary, description and capabilities. Zero means no match at all. */
export function relevance(item: PublicListing, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const name = item.name.toLowerCase(),
    tags = item.tags.join(' ').toLowerCase(),
    summary = item.summary.toLowerCase(),
    body = (item.description + ' ' + item.capabilities.join(' ')).toLowerCase();
  let score = 0;
  for (const w of words) {
    if (name === w) score += 6;
    else if (name.startsWith(w)) score += 4;
    else if (name.includes(w)) score += 3;
    if (tags.includes(w)) score += 2;
    if (summary.includes(w)) score += 1.5;
    if (body.includes(w)) score += 0.5;
  }
  return score;
}
const starsFor = (minStars: number | undefined): BrowseFilters['stars'] =>
  !minStars || minStars <= 0
    ? 'any'
    : minStars <= 100
      ? '100'
      : minStars <= 1000
        ? '1000'
        : '10000';
export function searchListings(
  items: PublicListing[],
  metrics: Map<string, BrowserMetrics>,
  search: FinderSearch,
  now = Date.now(),
) {
  const query = (search.query ?? '').trim().slice(0, 200);
  const limit = Math.min(50, Math.max(1, search.limit ?? 10)),
    offset = Math.max(0, search.offset ?? 0);
  const filters: BrowseFilters = {
    ...defaultFilters,
    q: '',
    kind: search.kind || 'all',
    category: search.category || defaultFilters.category,
    stars: starsFor(search.minStars),
    launched: search.launched ?? 'any',
    verified: Boolean(search.verifiedOnly),
    platform: search.platform ?? '',
  };
  const scored = items
    .map((item) => ({
      item,
      row: toBrowserListing(item, metrics.get(item.slug)),
      score: relevance(item, query),
    }))
    .filter(
      ({ row, score, item }) =>
        score > 0 &&
        matchesFilters(row, filters, now) &&
        (!search.minStars || (row.stars ?? 0) >= search.minStars) &&
        Boolean(item),
    );
  const sort = search.sort ?? (query ? 'relevance' : 'stars');
  const ordered =
    sort === 'relevance'
      ? scored
          .sort(
            (a, b) =>
              b.score - a.score ||
              (b.row.stars ?? -1) - (a.row.stars ?? -1) ||
              a.item.name.localeCompare(b.item.name),
          )
          .map((s) => s.row)
      : orderListings(
          scored.map((s) => s.row),
          sort === 'newest' ? 'launched' : sort,
        );
  return {
    total: ordered.length,
    offset,
    nextOffset: offset + limit < ordered.length ? offset + limit : null,
    listings: ordered.slice(offset, offset + limit).map(toRow),
  };
}
/** The public facts for one listing plus how to connect and the Q&A. */
export function listingDetail(item: PublicListing, metrics?: BrowserMetrics) {
  const plan = connectPlan(item);
  const row = toRow(toBrowserListing(item, metrics));
  return {
    ...row,
    description: item.description,
    repository: item.repository,
    documentation: item.documentation,
    endpoint: item.endpoint,
    tags: item.tags,
    pricing: item.pricing,
    transport: item.transport,
    authentication: item.authentication,
    platforms: item.platforms,
    license: item.license,
    capabilities: item.capabilities,
    setup: item.setup,
    mainFile: item.fileUrl || item.skillFile || '',
    forks: metrics?.forks ?? null,
    sourceUrl: item.sourceUrl,
    observedAt: item.observedAt,
    agenticCheckedAt: item.agenticCheckedAt ?? null,
    connect: {
      key: plan.key,
      remote: plan.remote,
      package: plan.pkg,
      agent: plan.agent,
      requiredHeaders: plan.requiredHeaders,
      requiredEnv: plan.requiredEnv,
      snippets: plan.snippets,
      cli:
        item.kind === 'server' && (plan.remote || plan.pkg)
          ? `npx ruagentic add ${item.slug}`
          : null,
    },
    faq: listingFaq(item),
  };
}
/** Side-by-side facts for a few listings. */
export function compareListings(
  items: PublicListing[],
  metrics: Map<string, BrowserMetrics>,
) {
  return items.map((item) => {
    const m = metrics.get(item.slug);
    return {
      ...toRow(toBrowserListing(item, m)),
      forks: m?.forks ?? null,
      pricing: item.pricing,
      transport: item.transport,
      authentication: item.authentication,
      platforms: item.platforms,
      license: item.license,
      capabilities: item.capabilities,
      repository: item.repository,
      endpoint: item.endpoint,
    };
  });
}
/** The taxonomy with counts, so a model can pick filters that exist. */
export function overview(items: PublicListing[]) {
  return {
    total: items.length,
    kinds: kinds.map((k) => ({
      kind: k.kind,
      name: k.name,
      description: k.description,
      count: items.filter((i) => i.kind === k.kind).length,
      browse: `${SITE}/${k.slug}`,
      leaderboard: `${SITE}/leaderboards/${k.slug}`,
    })),
    categories: categories.map((c) => ({
      name: c.name,
      description: c.description,
      count: items.filter((i) => i.category === c.name).length,
      browse: `${SITE}/categories/${c.slug}`,
    })),
  };
}
/** Listings added in the last `days` days, newest first. */
export function newListings(
  items: PublicListing[],
  metrics: Map<string, BrowserMetrics>,
  days: number,
  kind?: string,
  limit = 20,
  now = Date.now(),
) {
  const since = now - Math.min(90, Math.max(1, days)) * 86_400_000;
  return items
    .filter(
      (i) =>
        (!kind || i.kind === kind) &&
        Date.parse(i.publishedAt || i.observedAt) >= since,
    )
    .sort((a, b) =>
      (b.publishedAt || b.observedAt).localeCompare(
        a.publishedAt || a.observedAt,
      ),
    )
    .slice(0, Math.min(50, Math.max(1, limit)))
    .map((i) => ({
      ...toRow(toBrowserListing(i, metrics.get(i.slug))),
      addedAt: i.publishedAt || i.observedAt,
    }));
}
