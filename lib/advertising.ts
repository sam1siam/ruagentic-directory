import { z } from 'zod';
/** Sponsorship placements. The top bar is site-wide; the featured card is the
 *  first card in listing grids plus a tile on every listing detail page. */
export const placements = [
  {
    id: 'bar',
    name: 'Top bar',
    amount: 99900,
    display: 'US$999',
    placement:
      'Your name and tagline in the sponsor bar at the top of every page.',
    surfaces: ['bar'],
    save: '',
  },
  {
    id: 'card',
    name: 'Featured card',
    amount: 49900,
    display: 'US$499',
    placement:
      'A featured card in the home and listing grids, plus a tile on every listing detail page.',
    surfaces: ['listing', 'detail'],
    save: '',
  },
  {
    id: 'both',
    name: 'Top bar + featured card',
    amount: 129900,
    display: 'US$1,299',
    placement: 'Both placements together on every page of the directory.',
    surfaces: ['bar', 'listing', 'detail'],
    save: 'Save US$199 a month',
  },
] as const;
export type Placement = (typeof placements)[number];
export type PlacementId = Placement['id'];
export type Surface = 'bar' | 'listing' | 'detail';
export const placementById = (id: string) =>
  placements.find((p) => p.id === id);
/** Surfaces a placement is entitled to, widened so `includes` accepts any surface. */
export const placementSurfaces = (placement: Placement): readonly Surface[] =>
  placement.surfaces;
/** Card and tile placements need a longer description and a call to action. */
export const includesCard = (id: PlacementId) => id !== 'bar';
export const adApp = 'ruagentic-ads';
export type Sponsor = {
  name: string;
  tagline: string;
  description?: string;
  cta?: string;
  url: string;
  placement: PlacementId;
  house?: boolean;
};
/** The house sponsor shown in every slot no paid sponsor covers. The
 *  description is AstroFabric's own product wording. */
export const houseSponsor: Sponsor = {
  name: 'AstroFabric',
  tagline: 'Agentic AI for Business Intelligence',
  description:
    'Autonomous data infrastructure that turns strategic objectives into verified datasets and live intelligence streams.',
  cta: 'Explore AstroFabric',
  url: 'https://astrofabric.ai',
  placement: 'both',
  house: true,
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
    placement: z.enum(['bar', 'card', 'both']),
    product: z.string().trim().min(2).max(60),
    tagline: z.string().trim().min(10).max(120),
    url: httpsUrl,
    description: z.string().trim().max(200).default(''),
    cta: z.string().trim().max(24).default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (includesCard(value.placement) && value.description.length < 20)
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message:
          'Describe your product in at least 20 characters for the featured card.',
      });
    if (value.cta && value.cta.length < 2)
      ctx.addIssue({
        code: 'custom',
        path: ['cta'],
        message: 'Use at least two characters for the button label.',
      });
  });
export type Creative = z.infer<typeof creativeSchema>;
/** Stripe metadata is limited to 500 characters per value and 50 keys. */
export function creativeMetadata(creative: Creative) {
  return {
    app: adApp,
    placement: creative.placement,
    product: creative.product.slice(0, 120),
    tagline: creative.tagline.slice(0, 400),
    description: creative.description.slice(0, 500),
    cta: creative.cta.slice(0, 24),
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
/** Adds the directory as referrer without disturbing the sponsor's own
 *  parameters, fragment, or an existing ref value. */
export function sponsorHref(raw: string) {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('ref'))
      url.searchParams.set('ref', 'ruagentic.com');
    return url.href;
  } catch {
    return raw;
  }
}
/** Pick the sponsor for a surface. Paid sponsors take the slot ahead of the
 *  house sponsor and rotate every ten minutes so each one gets shown. */
export function pickSponsor(
  surface: Surface,
  sponsors: Sponsor[],
  now = Date.now(),
): Sponsor | null {
  const eligible = sponsors.filter((s) => {
    const placement = placementById(s.placement);
    return placement ? placementSurfaces(placement).includes(surface) : false;
  });
  if (!eligible.length) return null;
  const paid = eligible.filter((s) => !s.house);
  const pool = paid.length ? paid : eligible;
  return pool[Math.floor(now / 600000) % pool.length];
}
