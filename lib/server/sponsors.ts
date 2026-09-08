import { cache } from 'react';
import { houseSponsor, type Sponsor, type TierId } from '../advertising';
import { adminClient, configured } from '../supabase/server';
/** Active paid sponsors. The house sponsor fills the site-wide bar when no
 *  Platinum sponsor is active. Any storage problem degrades to the house
 *  sponsor rather than an error page. */
export const activeSponsors = cache(async (): Promise<Sponsor[]> => {
  if (!configured()) return [houseSponsor];
  try {
    const { data, error } = await adminClient()
      .from('ad_orders')
      .select('product,tagline,url,tier')
      .eq('status', 'active')
      .eq('livemode', true)
      .order('created_at')
      .limit(200);
    if (error) throw error;
    const paid = (data ?? []).map((row) => ({
      name: String(row.product),
      tagline: String(row.tagline),
      url: String(row.url),
      tier: row.tier as TierId,
    }));
    return paid.some((s) => s.tier === 'platinum')
      ? paid
      : [...paid, houseSponsor];
  } catch {
    return [houseSponsor];
  }
});
