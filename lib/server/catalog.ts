import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import seed from '@/data/catalog.json';
import { withoutAutoNote, type PublicListing } from '../listing';
import { configured, adminClient } from '../supabase/server';
import { catalogCacheSeconds, catalogCacheTag } from './catalog-cache';

const cacheOptions = {
  tags: [catalogCacheTag],
  revalidate: catalogCacheSeconds,
};
const batchSize = 100;
type CatalogRow = { slug: string; data: PublicListing | null };

async function readCatalogBatch(
  _project: string,
  offset: number,
): Promise<CatalogRow[]> {
  const { data, error } = await adminClient()
    .from('directory_entries')
    .select('slug,data,visible')
    .order('updated_at', { ascending: false })
    .order('slug')
    .range(offset, offset + batchSize - 1);
  if (error) throw new Error('The directory could not be loaded.');
  // Retain hidden slugs so the bundled fallback cannot resurrect them.
  // The shared cache stores no hidden listing payloads or account data.
  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    data: row.visible ? (row.data as PublicListing) : null,
  }));
}
// Cache batches rather than the nearly 2 MB catalog as a single cache entry.
// Project identity is an argument so different databases cannot share entries.
const cachedCatalogBatch = unstable_cache(
  readCatalogBatch,
  ['catalog-batch-v1'],
  cacheOptions,
);

async function readHiddenSlugs(_project: string): Promise<string[]> {
  const { data, error } = await adminClient()
    .from('catalog_overrides')
    .select('slug')
    .eq('hidden', true)
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((row) => row.slug as string);
}
const cachedHiddenSlugs = unstable_cache(
  readHiddenSlugs,
  ['catalog-hidden-v1'],
  cacheOptions,
);
/** The source-labelled entries shipped with the site. */
export const bundledCatalog = cache(async (): Promise<PublicListing[]> => {
  return seed as PublicListing[];
});
/** Slugs an admin hid from the Data health tab. Any storage problem hides
 *  nothing rather than breaking the directory. */
export const hiddenOverrides = cache(async (): Promise<Set<string>> => {
  if (!configured()) return new Set();
  try {
    return new Set(
      await readHiddenSlugs(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    );
  } catch {
    return new Set();
  }
});
/** Published listings. Database rows win; bundled source-labelled entries fill
 *  in slugs the database has not stored yet (the seed cron inserts them and
 *  refreshes imported rows when the bundle changes). A slug the database
 *  knows but hides stays hidden, and admin overrides hide bundled entries
 *  without a deploy. */
async function loadCatalog(fresh: boolean): Promise<PublicListing[]> {
  const bundled = await bundledCatalog();
  if (!configured()) return bundled;
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const readBatch = fresh ? readCatalogBatch : cachedCatalogBatch;
  const hidden = new Set(
    await (fresh ? readHiddenSlugs : cachedHiddenSlugs)(project),
  );
  const data: CatalogRow[] = [];
  for (let offset = 0; offset < 5000; offset += batchSize) {
    const batch = await readBatch(project, offset);
    data.push(...batch);
    if (batch.length < batchSize) break;
  }
  const known = new Set(data.map((row) => row.slug));
  return [
    ...data.flatMap((row) => (row.data ? [withoutAutoNote(row.data)] : [])),
    ...bundled.filter((item) => !known.has(item.slug)),
  ].filter((item) => !hidden.has(item.slug));
}
/** Public reads share the five-minute data cache across requests. */
export const catalog = cache(() => loadCatalog(false));
/** Publication decisions and admin review must never depend on stale data. */
export const freshCatalog = () => loadCatalog(true);
export async function listingBySlug(slug: string) {
  return (await catalog()).find((item) => item.slug === slug);
}
/** Where a merged listing's old address now points, if anywhere. */
export const redirectFor = cache(async (slug: string) => {
  if (!configured()) return null;
  try {
    const { data } = await adminClient()
      .from('listing_redirects')
      .select('target')
      .eq('slug', slug)
      .maybeSingle();
    return (data?.target as string | undefined) ?? null;
  } catch {
    return null;
  }
});
/** A listing by its current slug, or by a slug that was merged into it;
 *  `moved` tells callers to redirect to the current address. */
export async function listingByAnySlug(slug: string) {
  const item = await listingBySlug(slug);
  if (item) return { item, moved: false };
  const target = await redirectFor(slug);
  const moved = target ? await listingBySlug(target) : undefined;
  return moved ? { item: moved, moved: true } : null;
}
/** The fields whose change means an imported database row should be
 *  refreshed from the bundle. */
export const fingerprint = (item: PublicListing) =>
  [item.name, item.category, item.summary, item.observedAt, item.kind]
    .concat(item.tags)
    .join('|');
