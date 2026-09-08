import { cache } from 'react';
import seed from '@/data/catalog.json';
import type { PublicListing } from '../listing';
import { configured, adminClient } from '../supabase/server';
export const catalog = cache(async (): Promise<PublicListing[]> => {
  if (!configured()) return seed as PublicListing[];
  const { data, error } = await adminClient()
    .from('directory_entries')
    .select('data')
    .eq('visible', true)
    .order('updated_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error('The directory could not be loaded.');
  return (data ?? []).map((row) => row.data as PublicListing);
});
export async function listingBySlug(slug: string) {
  return (await catalog()).find((item) => item.slug === slug);
}
