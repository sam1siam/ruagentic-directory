import { cache } from 'react';
import seed from '@/data/catalog.json';
import type { PublicListing } from '../listing';
import { configured, adminClient } from '../supabase/server';
/** The source-labelled entries shipped with the site. */
export const bundledCatalog = cache(async (): Promise<PublicListing[]> => {
  return seed as PublicListing[];
});
/** Slugs an admin hid from the Data health tab. Any storage problem hides
 *  nothing rather than breaking the directory. */
export const hiddenOverrides = cache(async (): Promise<Set<string>> => {
  if (!configured()) return new Set();
  try {
    const { data, error } = await adminClient()
      .from('catalog_overrides')
      .select('slug')
      .eq('hidden', true)
      .limit(5000);
    if (error) return new Set();
    return new Set((data ?? []).map((row) => row.slug as string));
  } catch {
    return new Set();
  }
});
/** Published listings. Database rows win; bundled source-labelled entries fill
 *  in slugs the database has not stored yet (the seed cron inserts them and
 *  refreshes imported rows when the bundle changes). A slug the database
 *  knows but hides stays hidden, and admin overrides hide bundled entries
 *  without a deploy. */
export const catalog = cache(async (): Promise<PublicListing[]> => {
  const bundled = await bundledCatalog();
  if (!configured()) return bundled;
  const [{ data, error }, hidden] = await Promise.all([
    adminClient()
      .from('directory_entries')
      .select('slug,data,visible')
      .order('updated_at', { ascending: false })
      .limit(5000),
    hiddenOverrides(),
  ]);
  if (error) throw new Error('The directory could not be loaded.');
  const known = new Set((data ?? []).map((row) => row.slug as string));
  return [
    ...(data ?? [])
      .filter((row) => row.visible)
      .map((row) => row.data as PublicListing),
    ...bundled.filter((item) => !known.has(item.slug)),
  ].filter((item) => !hidden.has(item.slug));
});
export async function listingBySlug(slug: string) {
  return (await catalog()).find((item) => item.slug === slug);
}
/** The fields whose change means an imported database row should be
 *  refreshed from the bundle. */
export const fingerprint = (item: PublicListing) =>
  [item.name, item.category, item.summary, item.observedAt, item.kind]
    .concat(item.tags)
    .join('|');
