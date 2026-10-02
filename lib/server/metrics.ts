import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { adminClient, configured } from '../supabase/server';
import { catalog } from './catalog';
import type { BrowseFilters, BrowserMetrics } from '../browse';
import { apiJson } from '../discovery/http';
import { object } from '../discovery/contracts';
import { providerHold } from '../discovery/http';
import {
  rankListings,
  refreshOrder,
  type ListingMetrics,
  type RankBy,
  type RankedListing,
} from '../leaderboard';

const tag = 'listing-metrics';
const missingTable = (error: { code?: string; message?: string }) =>
  error.code === '42P01' ||
  error.code === 'PGRST205' ||
  /schema cache|does not exist/i.test(error.message ?? '');
// `*` so the read works before and after the created_at column migration.
const columns = '*';

/** Every collected row. Missing table (migration not applied) reads as none. */
async function readMetrics(_project: string): Promise<ListingMetrics[]> {
  const rows: ListingMetrics[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await adminClient()
      .from('listing_metrics')
      .select(columns)
      .order('slug')
      .range(offset, offset + 999);
    if (error) {
      // No table yet (migration pending) or an API schema cache that has not
      // seen it: the boards simply show that nothing was collected.
      if (missingTable(error)) return [];
      // Any other read problem (for example missing grants) is logged and
      // shows as nothing collected rather than a failed page.
      console.error('listing_metrics read failed', error.code, error.message);
      return [];
    }
    rows.push(...((data ?? []) as ListingMetrics[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
const cachedMetrics = unstable_cache(readMetrics, ['listing-metrics-v1'], {
  tags: [tag],
  revalidate: 600,
});
export async function listingMetrics(): Promise<ListingMetrics[]> {
  if (!configured()) return [];
  return cachedMetrics(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
}
export async function metricsReady() {
  if (!configured()) return false;
  const { error } = await adminClient()
    .from('listing_metrics')
    .select('slug')
    .limit(1);
  if (error)
    console.error('listing_metrics check failed', error.code, error.message);
  return !error;
}
/** When the newest row was collected, or null before the first run. */
export async function metricsCollectedAt() {
  const rows = await listingMetrics();
  return (
    rows
      .map((r) => r.fetched_at)
      .sort()
      .at(-1) ?? null
  );
}
/** Stars, forks and creation date per slug, for the browser's filters. */
export async function browserMetrics(): Promise<Map<string, BrowserMetrics>> {
  const rows = await listingMetrics();
  return new Map(
    rows
      .filter((r) => !r.error)
      .map((r) => [
        r.slug,
        { stars: r.stars, forks: r.forks, createdAt: r.created_at ?? null },
      ]),
  );
}
export async function leaderboard(
  kind?: string,
  limit = 100,
  by: RankBy = 'stars',
  filters?: BrowseFilters,
): Promise<RankedListing[]> {
  const [items, metrics] = await Promise.all([catalog(), listingMetrics()]);
  return rankListings(items, metrics, kind, limit, by, filters);
}
/** Refreshes the oldest metrics first through GitHub's repository API,
 *  paced by the shared provider pacer. Stops on a rate limit and leaves
 *  the rest for the next hour. Reads public data only. */
export async function refreshMetrics(limit: number, deadline: number) {
  const [items, metrics] = await Promise.all([catalog(), listingMetrics()]);
  const queue = refreshOrder(items, metrics, limit);
  const summary = { candidates: queue.length, updated: 0, missing: 0, held: 0 };
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
  const now = () => new Date().toISOString();
  // The creation-time column arrived in a later migration; write it only
  // once the table has it, so a pending migration cannot stall refreshes.
  const hasCreated = !(
    await adminClient().from('listing_metrics').select('created_at').limit(1)
  ).error;
  const rows: Partial<ListingMetrics>[] = [];
  for (const item of queue) {
    if (Date.now() > deadline - 15_000) break;
    try {
      const repo = object(
        await apiJson(
          'https://api.github.com/repos/' + item.repo,
          { headers },
          deadline,
        ),
      );
      rows.push({
        slug: item.slug,
        repository: item.repository,
        stars: Number(repo.stargazers_count) || 0,
        forks: Number(repo.forks_count) || 0,
        watchers: Number(repo.subscribers_count) || 0,
        open_issues: Number(repo.open_issues_count) || 0,
        pushed_at: typeof repo.pushed_at === 'string' ? repo.pushed_at : null,
        ...(hasCreated
          ? {
              created_at:
                typeof repo.created_at === 'string' ? repo.created_at : null,
            }
          : {}),
        fetched_at: now(),
        error: null,
      });
      summary.updated++;
    } catch (error) {
      if (providerHold(error)) {
        summary.held = queue.length - summary.updated - summary.missing;
        break;
      }
      // A repository that is gone or private is recorded so it is not
      // retried every hour; it never ranks.
      // Every row carries the same keys: a bulk upsert refuses mixed shapes.
      rows.push({
        slug: item.slug,
        repository: item.repository,
        stars: 0,
        forks: 0,
        watchers: 0,
        open_issues: 0,
        pushed_at: null,
        ...(hasCreated ? { created_at: null } : {}),
        fetched_at: now(),
        error: (error instanceof Error ? error.message : 'unavailable').slice(
          0,
          160,
        ),
      });
      summary.missing++;
    }
  }
  if (rows.length) {
    const { error } = await adminClient()
      .from('listing_metrics')
      .upsert(rows, { onConflict: 'slug' });
    if (error) {
      console.error('listing_metrics save failed', error.code, error.message);
      throw new Error('Listing metrics could not be saved.');
    }
    revalidateTag(tag, { expire: 0 });
  }
  return summary;
}
