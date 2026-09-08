import { cache } from 'react';
import seed from '@/data/catalog.json';
import type { PublicListing } from '../listing';
import { configured, adminClient } from '../supabase/server';
/** Published listings. Database rows win; bundled source-labelled entries fill
 *  in slugs the database has not stored yet (the seed cron inserts them). A
 *  slug the database knows but hides stays hidden. */
export const catalog = cache(async (): Promise<PublicListing[]> => {
  const bundled = seed as PublicListing[];
  if (!configured()) return bundled;
  const { data, error } = await adminClient()
    .from('directory_entries')
    .select('slug,data,visible')
    .order('updated_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error('The directory could not be loaded.');
  const known = new Set((data ?? []).map((row) => row.slug as string));
  return [
    ...(data ?? [])
      .filter((row) => row.visible)
      .map((row) => row.data as PublicListing),
    ...bundled.filter((item) => !known.has(item.slug)),
  ];
});
export async function listingBySlug(slug: string) {
  return (await catalog()).find((item) => item.slug === slug);
}
