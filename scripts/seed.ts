import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { listingSchema } from '../lib/listing.ts';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error('Set the directory Supabase URL and secret key.');
const db = createClient(url, key, { auth: { persistSession: false } });
const rows = JSON.parse(
  await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'),
);
for (const row of rows) {
  const {
    slug,
    source: _source,
    sourceUrl: _sourceUrl,
    observedAt: _observedAt,
    publishedAt,
    imported,
    registry: _registry,
    packages: _packages,
    remotes: _remotes,
    sources: _sources,
    ...input
  } = row;
  listingSchema.parse(input);
  if (!imported) throw new Error('Seed accepts imported entries only.');
  const { error } = await db.from('directory_entries').upsert(
    {
      slug,
      data: { ...row, publishedAt: publishedAt || new Date().toISOString() },
      visible: true,
    },
    { onConflict: 'slug', ignoreDuplicates: true },
  );
  if (error) throw error;
}
console.log(
  'Imported ' +
    rows.length +
    ' source-labeled directory entries. Existing entries were preserved.',
);
