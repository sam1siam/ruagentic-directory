import 'server-only';
import { adminClient, configured } from '../supabase/server';
import { aggregateViews, type ViewRow, type ViewTotals } from '../views';

/** Counts one page view; any storage problem is swallowed so a listing page
 *  never fails because of its counter. */
export async function recordView(slug: string) {
  if (!configured()) return;
  const { error } = await adminClient().rpc('bump_listing_view', {
    p_slug: slug,
  });
  if (error) console.error('listing_views bump failed', error.code);
}
/** Counts one CLI install; failures are swallowed like views. */
export async function recordInstall(slug: string, client: string) {
  if (!configured()) return;
  const { error } = await adminClient().rpc('bump_listing_install', {
    p_slug: slug,
    p_client: client,
  });
  if (error) console.error('listing_installs bump failed', error.code);
}
/** CLI installs per slug: last 30 days and all time. */
export async function installsFor(
  slugs: string[],
): Promise<Map<string, { month: number; total: number }>> {
  if (!configured() || !slugs.length) return new Map();
  const { data, error } = await adminClient()
    .from('listing_installs')
    .select('slug,day,installs')
    .in('slug', slugs)
    .limit(20000);
  if (error) {
    console.error('listing_installs read failed', error.code);
    return new Map();
  }
  const totals = aggregateViews(
    (data ?? []).map((r) => ({
      slug: String(r.slug),
      day: String(r.day),
      views: Number(r.installs) || 0,
    })),
  );
  return new Map(
    [...totals].map(([slug, t]) => [slug, { month: t.month, total: t.total }]),
  );
}
/** Totals for the given slugs, or an empty map when the table is not there. */
export async function viewsFor(
  slugs: string[],
): Promise<Map<string, ViewTotals>> {
  if (!configured() || !slugs.length) return new Map();
  const { data, error } = await adminClient()
    .from('listing_views')
    .select('slug,day,views')
    .in('slug', slugs)
    .limit(20000);
  if (error) {
    console.error('listing_views read failed', error.code);
    return new Map();
  }
  return aggregateViews((data ?? []) as ViewRow[]);
}
