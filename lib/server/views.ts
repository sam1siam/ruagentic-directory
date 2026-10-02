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
