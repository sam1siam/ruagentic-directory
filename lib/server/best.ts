import 'server-only';
import { catalog } from './catalog';
import { listingMetrics, metricsCollectedAt } from './metrics';
import {
  categories,
  categoryBySlug,
  kindBySlug,
  kinds,
  type Category,
  type KindPage,
} from '../categories';
import { defaultFilters } from '../browse';
import { rankListings, type RankedListing } from '../leaderboard';
import type { PublicListing } from '../listing';

/** A "Best <kind> for <category>" page exists once the pair has this many
 *  listings; fewer would be a thin page. */
export const BEST_MIN = 3;
export type BestCombo = { kind: KindPage; category: Category; count: number };

export async function bestCombos(): Promise<BestCombo[]> {
  const items = await catalog();
  const combos: BestCombo[] = [];
  for (const kind of kinds)
    for (const category of categories) {
      const count = items.filter(
        (i) => i.kind === kind.kind && i.category === category.name,
      ).length;
      if (count >= BEST_MIN) combos.push({ kind, category, count });
    }
  return combos.sort((a, b) => b.count - a.count);
}
export async function bestPage(kindSlug: string, categorySlug: string) {
  const kind = kindBySlug(kindSlug),
    category = categoryBySlug(categorySlug);
  if (!kind || !category) return null;
  const [items, metrics, collected] = await Promise.all([
    catalog(),
    listingMetrics(),
    metricsCollectedAt(),
  ]);
  const inScope = items.filter(
    (i) => i.kind === kind.kind && i.category === category.name,
  );
  if (inScope.length < BEST_MIN) return null;
  const ranked: RankedListing[] = rankListings(
    inScope,
    metrics,
    kind.kind,
    20,
    'stars',
    { ...defaultFilters, category: category.name },
  );
  const rankedSlugs = new Set(ranked.map((r) => r.slug));
  const unranked: PublicListing[] = inScope
    .filter((i) => !rankedSlugs.has(i.slug))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { kind, category, ranked, unranked, count: inScope.length, collected };
}
