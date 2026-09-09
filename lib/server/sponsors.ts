import { cache } from 'react';
import {
  houseSponsor,
  parseCategories,
  type PlacementId,
  type Sponsor,
} from '../advertising';
import { adminClient, configured } from '../supabase/server';
/** Approved, active paid sponsors followed by the house sponsor, which fills
 *  any slot no paid sponsor covers. Orders wait for a reviewer's approval
 *  before they render. Any storage problem degrades to the house sponsor
 *  rather than an error page. */
export const activeSponsors = cache(async (): Promise<Sponsor[]> => {
  if (!configured()) return [houseSponsor];
  try {
    const { data, error } = await adminClient()
      .from('ad_orders')
      .select('product,tagline,description,cta,url,placement,categories,slug')
      .eq('status', 'active')
      .eq('approval', 'approved')
      .eq('livemode', true)
      .order('created_at')
      .limit(200);
    if (error) throw error;
    const paid = (data ?? []).map((row) => ({
      name: String(row.product),
      tagline: String(row.tagline),
      description: String(row.description ?? ''),
      cta: String(row.cta ?? ''),
      url: String(row.url),
      page: '/sponsors/' + encodeURIComponent(String(row.slug)),
      placement: row.placement as PlacementId,
      categories: parseCategories(row.categories),
    }));
    return [...paid, houseSponsor];
  } catch {
    return [houseSponsor];
  }
});
/** One sponsor by its page slug; the house sponsor has a listing page instead. */
export async function sponsorBySlug(slug: string) {
  return (
    (await activeSponsors()).find(
      (s) => !s.house && s.page === '/sponsors/' + encodeURIComponent(slug),
    ) ?? null
  );
}
