import { z } from 'zod';
/** Sponsorship tiers. Placement follows mcp.so's structure: the top bar is
 *  site-wide, listing pages carry a sponsored card, detail pages a sponsor tile. */
export const tiers = [
  {
    id: 'platinum',
    name: 'Platinum Sponsor',
    amount: 129900,
    display: 'US$1,299',
    placement:
      'Site-wide: top bar on every page plus listing and detail pages.',
    surfaces: ['bar', 'listing', 'detail'],
    rank: 3,
  },
  {
    id: 'gold',
    name: 'Gold Sponsor',
    amount: 69900,
    display: 'US$699',
    placement: 'Listing pages and detail pages.',
    surfaces: ['listing', 'detail'],
    rank: 2,
  },
  {
    id: 'silver',
    name: 'Silver Sponsor',
    amount: 39900,
    display: 'US$399',
    placement: 'Detail pages only.',
    surfaces: ['detail'],
    rank: 1,
  },
] as const;
export type Tier = (typeof tiers)[number];
export type TierId = Tier['id'];
export type Surface = 'bar' | 'listing' | 'detail';
/** Surfaces a tier is entitled to, widened so `includes` accepts any surface. */
export const tierSurfaces = (tier: Tier): readonly Surface[] => tier.surfaces;
export const tierById = (id: string) => tiers.find((t) => t.id === id);
export const adApp = 'ruagentic-ads';
/** The house sponsor shown whenever no paid Platinum sponsor is active. */
export const houseSponsor = {
  name: 'AstroFabric',
  tagline: 'Agentic AI for Business Intelligence',
  url: 'https://astrofabric.ai',
  tier: 'platinum' as TierId,
  house: true,
};
export type Sponsor = {
  name: string;
  tagline: string;
  url: string;
  tier: TierId;
  house?: boolean;
};
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use a public https:// address.');
export const creativeSchema = z
  .object({
    tier: z.enum(['platinum', 'gold', 'silver']),
    product: z.string().trim().min(2).max(60),
    tagline: z.string().trim().min(10).max(160),
    url: httpsUrl,
  })
  .strict();
export type Creative = z.infer<typeof creativeSchema>;
/** Stripe metadata is limited to 500 characters per value and 50 keys. */
export function creativeMetadata(creative: Creative) {
  return {
    app: adApp,
    tier: creative.tier,
    product: creative.product.slice(0, 120),
    tagline: creative.tagline.slice(0, 400),
    url: creative.url.slice(0, 500),
  };
}
export function isAdMetadata(
  metadata: unknown,
): metadata is Record<string, string> {
  return (
    metadata !== null &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).app === adApp
  );
}
/** Pick the sponsor for a surface: highest tier first, rotating within that
 *  tier every ten minutes so every sponsor at the same level gets shown. */
export function pickSponsor(
  surface: Surface,
  sponsors: Sponsor[],
  now = Date.now(),
): Sponsor | null {
  const eligible = sponsors.filter((s) => {
    const tier = tierById(s.tier);
    return tier ? tierSurfaces(tier).includes(surface) : false;
  });
  if (!eligible.length) return null;
  const top = Math.max(...eligible.map((s) => tierById(s.tier)!.rank));
  const pool = eligible.filter((s) => tierById(s.tier)!.rank === top);
  return pool[Math.floor(now / 600000) % pool.length];
}
