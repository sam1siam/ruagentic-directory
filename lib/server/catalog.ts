import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import seed from '@/data/catalog.json';
import { withoutAutoNote, type PublicListing } from '../listing';
import { configured, adminClient } from '../supabase/server';
import { catalogCacheSeconds, catalogCacheTag } from './catalog-cache';
import { createBreaker, newestFirst } from '../db-resilience.ts';

const cacheOptions = {
  tags: [catalogCacheTag],
  revalidate: catalogCacheSeconds,
};
// About 2 KB a row, so a batch stays well under the 2 MB cache entry limit
// while a full read takes a handful of requests instead of dozens.
const batchSize = 400;
type CatalogRow = {
  slug: string;
  updatedAt: string;
  data: PublicListing | null;
};

async function readCatalogBatch(
  _project: string,
  offset: number,
): Promise<CatalogRow[]> {
  const { data, error } = await adminClient()
    .from('directory_entries')
    .select('slug,data,visible,updated_at')
    // The primary key keeps pages stable and needs no sort of the table;
    // the newest-first order is applied after reading.
    .order('slug')
    .range(offset, offset + batchSize - 1);
  if (error) throw new Error('The directory could not be loaded.');
  // Retain hidden slugs so the bundled fallback cannot resurrect them.
  // The shared cache stores no hidden listing payloads or account data.
  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    updatedAt: String(row.updated_at ?? ''),
    data: row.visible ? (row.data as PublicListing) : null,
  }));
}
// Cache batches rather than the nearly 2 MB catalog as a single cache entry.
// Project identity is an argument so different databases cannot share entries.
const cachedCatalogBatch = unstable_cache(
  readCatalogBatch,
  ['catalog-batch-v2'],
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
  for (let offset = 0; offset < 20000; offset += batchSize) {
    const batch = await readBatch(project, offset);
    data.push(...batch);
    if (batch.length < batchSize) break;
  }
  data.sort(newestFirst);
  const known = new Set(data.map((row) => row.slug));
  return [
    ...data.flatMap((row) => (row.data ? [withoutAutoNote(row.data)] : [])),
    ...bundled.filter((item) => !known.has(item.slug)),
  ].filter((item) => !hidden.has(item.slug));
}
// When the database fails, public pages show the last catalog this instance
// read (or the bundled entries) and skip the database for half a minute,
// instead of every request waiting on it.
const breaker = createBreaker(30_000);
let lastGood: PublicListing[] | null = null;
async function publicCatalog(): Promise<PublicListing[]> {
  if (configured() && !breaker.isOpen())
    try {
      lastGood = await loadCatalog(false);
      return lastGood;
    } catch (error) {
      breaker.trip();
      console.error(
        'catalog_read_failed',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  return lastGood ?? (await bundledCatalog());
}
/** Public reads share the five-minute data cache across requests. */
export const catalog = cache(publicCatalog);
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
