import { cache } from 'react';
import { houseSponsor, type PlacementId, type Sponsor } from '../advertising';
import { adminClient, configured } from '../supabase/server';
/** Active paid sponsors followed by the house sponsor, which fills any slot
 *  no paid sponsor covers. Any storage problem degrades to the house sponsor
 *  rather than an error page. */
export const activeSponsors = cache(async (): Promise<Sponsor[]> => {
  if (!configured()) return [houseSponsor];
  try {
    const { data, error } = await adminClient()
      .from('ad_orders')
      .select('product,tagline,description,cta,url,placement')
      .eq('status', 'active')
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
      placement: row.placement as PlacementId,
    }));
    return [...paid, houseSponsor];
  } catch {
    return [houseSponsor];
  }
});
