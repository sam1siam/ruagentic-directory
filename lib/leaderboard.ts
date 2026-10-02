/** Pure ranking for the leaderboards. The only signals are the public GitHub
 *  figures the metrics cron collected: the star count, and for the pace
 *  board the star count divided by the repository's age. The directory
 *  records nothing else about popularity, and sponsorship never changes a
 *  rank. */
import type { PublicListing } from './listing.ts';

export type ListingMetrics = {
  slug: string;
  repository: string;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  pushed_at: string | null;
  fetched_at: string;
  created_at?: string | null;
  error?: string | null;
};
export type RankBy = 'stars' | 'pace';
export const rankModes: { by: RankBy; label: string }[] = [
  { by: 'stars', label: 'Top' },
  { by: 'pace', label: 'Fastest since launch' },
];
export const parseRankBy = (value: unknown): RankBy =>
  value === 'pace' ? 'pace' : 'stars';
/** Pace needs a little history behind it: a day-old repository with ten
 *  stars would otherwise lead every board. */
export const PACE_MIN_DAYS = 14;
export const PACE_MIN_STARS = 10;
export type RankedListing = {
  rank: number;
  slug: string;
  name: string;
  kind: string;
  category: string;
  summary: string;
  repository: string;
  stars: number;
  forks: number;
  pushedAt: string | null;
  createdAt: string | null;
  /** Stars divided by the repository's age in days, or null without a date. */
  starsPerDay: number | null;
  fetchedAt: string;
  verified: boolean;
  /** Other listings that link the same repository and so share its count. */
  siblings: number;
};
/** The GitHub `owner/repo` behind a listing's repository URL, if any. */
export function githubRepo(url: string | undefined): string | undefined {
  if (!url) return;
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return;
    const [owner, repo] = u.pathname.split('/').filter(Boolean);
    if (!owner || !repo) return;
    return `${owner}/${repo.replace(/\.git$/, '')}`.toLowerCase();
  } catch {
    return;
  }
}
/** Whole days between the repository's creation and the collection time. */
export function ageDays(m: ListingMetrics): number | null {
  if (!m.created_at) return null;
  const created = Date.parse(m.created_at),
    fetched = Date.parse(m.fetched_at);
  if (!Number.isFinite(created) || !Number.isFinite(fetched)) return null;
  return Math.max(1, Math.floor((fetched - created) / 86_400_000));
}
export function starsPerDay(m: ListingMetrics): number | null {
  const days = ageDays(m);
  return days === null ? null : m.stars / days;
}
/** Listings of one kind (or all) with collected metrics, best first. "stars"
 *  orders by stars, then forks, then name; "pace" orders by stars per day
 *  since the repository was created, then stars, then name, and leaves out
 *  repositories younger than PACE_MIN_DAYS or under PACE_MIN_STARS. Stars
 *  belong to a repository, so one row stands for every listing that links
 *  the same repository and the row says how many more there are. */
export function rankListings(
  listings: PublicListing[],
  metrics: ListingMetrics[],
  kind?: string,
  limit = 100,
  by: RankBy = 'stars',
): RankedListing[] {
  const bySlug = new Map(
    metrics.filter((m) => !m.error).map((m) => [m.slug, m]),
  );
  const eligible = (m: ListingMetrics) =>
    by === 'stars' ||
    ((ageDays(m) ?? 0) >= PACE_MIN_DAYS && m.stars >= PACE_MIN_STARS);
  const ranked = listings
    .filter(
      (l) =>
        (!kind || l.kind === kind) &&
        bySlug.has(l.slug) &&
        eligible(bySlug.get(l.slug)!),
    )
    .map((l) => ({ listing: l, m: bySlug.get(l.slug)! }))
    .sort((a, b) =>
      by === 'pace'
        ? (starsPerDay(b.m) ?? 0) - (starsPerDay(a.m) ?? 0) ||
          b.m.stars - a.m.stars ||
          a.listing.name.localeCompare(b.listing.name)
        : b.m.stars - a.m.stars ||
          b.m.forks - a.m.forks ||
          a.listing.name.localeCompare(b.listing.name),
    );
  const seen = new Map<string, number>();
  const rows: RankedListing[] = [];
  for (const { listing, m } of ranked) {
    const repo = githubRepo(listing.repository) ?? listing.slug;
    const index = seen.get(repo);
    if (index !== undefined) {
      rows[index]!.siblings++;
      continue;
    }
    if (rows.length >= limit) continue;
    seen.set(repo, rows.length);
    rows.push({
      rank: rows.length + 1,
      slug: listing.slug,
      name: listing.name,
      kind: listing.kind,
      category: listing.category,
      summary: listing.summary,
      repository: listing.repository,
      stars: m.stars,
      forks: m.forks,
      pushedAt: m.pushed_at,
      createdAt: m.created_at ?? null,
      starsPerDay: starsPerDay(m),
      fetchedAt: m.fetched_at,
      verified: Boolean(listing.agenticCheckedAt),
      siblings: 0,
    });
  }
  return rows;
}
/** The slugs whose metrics are missing or oldest, for the next refresh. */
export function refreshOrder(
  listings: PublicListing[],
  metrics: ListingMetrics[],
  limit: number,
): { slug: string; repo: string; repository: string }[] {
  const fetched = new Map(metrics.map((m) => [m.slug, m.fetched_at]));
  return listings
    .map((l) => ({
      slug: l.slug,
      repo: githubRepo(l.repository) ?? '',
      repository: l.repository,
    }))
    .filter((l) => l.repo)
    .sort((a, b) => {
      const fa = fetched.get(a.slug),
        fb = fetched.get(b.slug);
      if (!fa && fb) return -1;
      if (fa && !fb) return 1;
      return (fa ?? '').localeCompare(fb ?? '') || a.slug.localeCompare(b.slug);
    })
    .slice(0, limit);
}
export const compact = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1000
      ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
      : String(n);
/** Stars per day for display: one decimal under ten, whole above. */
export const pace = (n: number | null) =>
  n === null
    ? '—'
    : n >= 10
      ? Math.round(n).toLocaleString('en-US')
      : n.toFixed(1);
