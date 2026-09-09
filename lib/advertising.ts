import { z } from 'zod';
import { categories, categoryBySlug } from './categories.ts';
/** Sponsorship placements. The top bar is site-wide; the featured card is the
 *  first card on the category pages a sponsor chooses (one included, more for
 *  a monthly extra), on the kind pages and home, plus a tile on detail pages
 *  in those categories. */
export const placements = [
  {
    id: 'bar',
    name: 'Top bar',
    amount: 99900,
    placement:
      'Your name and tagline in the sponsor bar at the top of every page.',
    surfaces: ['bar'],
    save: '',
  },
  {
    id: 'card',
    name: 'Featured card',
    amount: 49900,
    placement:
      'A featured card on the category pages you choose, on the server, client and product pages and the home page, plus a tile on listing detail pages in your categories.',
    surfaces: ['listing', 'detail'],
    save: '',
  },
  {
    id: 'both',
    name: 'Top bar + featured card',
    amount: 129900,
    placement: 'Both placements together across the directory.',
    surfaces: ['bar', 'listing', 'detail'],
    save: 'Save US$199 a month',
  },
] as const;
/** Monthly price of each category beyond the first for card placements. */
export const categoryExtraAmount = 5000;
export type Placement = (typeof placements)[number];
export type PlacementId = Placement['id'];
export type Surface = 'bar' | 'listing' | 'detail';
export const placementById = (id: string) =>
  placements.find((p) => p.id === id);
/** Surfaces a placement is entitled to, widened so `includes` accepts any surface. */
export const placementSurfaces = (placement: Placement): readonly Surface[] =>
  placement.surfaces;
/** Card and tile placements need a description, a call to action and categories. */
export const includesCard = (id: PlacementId) => id !== 'bar';
export const adApp = 'ruagentic-ads';
export const categorySlugs = categories.map((c) => c.slug);
export const formatUsd = (cents: number) =>
  'US$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
/** Monthly total for a placement and the chosen categories. */
export function quote(placement: PlacementId, chosen: readonly string[]) {
  const base = placementById(placement)!;
  const extras = includesCard(placement) ? Math.max(0, chosen.length - 1) : 0;
  const amount = base.amount + extras * categoryExtraAmount;
  return { amount, extras, display: formatUsd(amount) };
}
export type Sponsor = {
  name: string;
  tagline: string;
  description?: string;
  cta?: string;
  url: string;
  /** Internal page the card and tile open; the outbound link lives there. */
  page: string;
  placement: PlacementId;
  /** Category slugs the card placement covers; empty means every category. */
  categories: string[];
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
  page: '/tools/astrofabric',
  placement: 'both',
  categories: [],
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
    categories: z
      .array(z.string().refine((s) => Boolean(categoryBySlug(s))))
      .max(categorySlugs.length)
      .default([]),
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
    if (includesCard(value.placement) && value.categories.length < 1)
      ctx.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'Choose at least one category for the featured card.',
      });
    if (new Set(value.categories).size !== value.categories.length)
      ctx.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'Each category can be chosen once.',
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
  const cats = includesCard(creative.placement) ? creative.categories : [];
  return {
    app: adApp,
    placement: creative.placement,
    product: creative.product.slice(0, 120),
    tagline: creative.tagline.slice(0, 400),
    description: creative.description.slice(0, 500),
    cta: creative.cta.slice(0, 24),
    categories: cats.join(','),
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
export const parseCategories = (value: string | null | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => categoryBySlug(s));
/** Stable, URL-safe id for a sponsor's page, derived from the product name
 *  and the checkout session so two sponsors with one name never collide. */
export function sponsorSlug(product: string, sessionId: string) {
  const base =
    product
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'sponsor';
  return (
    base +
    '-' +
    sessionId
      .replace(/[^a-z0-9]/gi, '')
      .slice(-6)
      .toLowerCase()
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
/** Pick the sponsor for a surface, optionally within a category. Paid
 *  sponsors take the slot ahead of the house sponsor and rotate every ten
 *  minutes so each one gets shown. */
export function pickSponsor(
  surface: Surface,
  sponsors: Sponsor[],
  now = Date.now(),
  category?: string,
): Sponsor | null {
  const eligible = sponsors.filter((s) => {
    const placement = placementById(s.placement);
    if (!placement || !placementSurfaces(placement).includes(surface))
      return false;
    if (surface === 'bar' || !category || !s.categories.length) return true;
    return s.categories.includes(category);
  });
  if (!eligible.length) return null;
  const paid = eligible.filter((s) => !s.house);
  const pool = paid.length ? paid : eligible;
  return pool[Math.floor(now / 600000) % pool.length];
}
/** Fields a sponsor may change after buying; the placement itself and the
 *  target URL are fixed by the order. */
export type CreativeEdit = {
  tagline: string;
  description: string;
  cta: string;
  categories: string[];
};
export function creativeEditSchema(placement: PlacementId) {
  return z
    .object({
      tagline: z.string().trim().min(10).max(120),
      description: z.string().trim().max(200).default(''),
      cta: z.string().trim().max(24).default(''),
      categories: z
        .array(z.string().refine((s) => Boolean(categoryBySlug(s))))
        .max(categorySlugs.length)
        .default([]),
    })
    .strict()
    .transform((value) =>
      includesCard(placement)
        ? value
        : { ...value, description: '', cta: '', categories: [] },
    )
    .superRefine((value, ctx) => {
      if (!includesCard(placement)) return;
      if (value.description.length < 20)
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message:
            'Describe your product in at least 20 characters for the featured card.',
        });
      if (value.categories.length < 1)
        ctx.addIssue({
          code: 'custom',
          path: ['categories'],
          message: 'Choose at least one category for the featured card.',
        });
      if (new Set(value.categories).size !== value.categories.length)
        ctx.addIssue({
          code: 'custom',
          path: ['categories'],
          message: 'Each category can be chosen once.',
        });
    });
}
/** What to do with the "extra category" subscription item so billing matches
 *  the chosen categories: one category is included, the rest are billed. */
export function categoryItemPlan(
  currentQuantity: number | null,
  categories: readonly string[],
): { action: 'none' | 'create' | 'update' | 'delete'; quantity: number } {
  const quantity = Math.max(0, categories.length - 1);
  if (quantity === 0)
    return { action: currentQuantity === null ? 'none' : 'delete', quantity };
  if (currentQuantity === null) return { action: 'create', quantity };
  return { action: currentQuantity === quantity ? 'none' : 'update', quantity };
}
