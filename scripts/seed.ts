import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { prepareCatalog } from '../lib/catalog-import.ts';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error('Set the directory Supabase URL and secret key.');
const db = createClient(url, key, { auth: { persistSession: false } });
const rows = prepareCatalog(
  JSON.parse(
    await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'),
  ),
);
let inserted = 0;
for (const row of rows) {
  const { data, error } = await db
    .from('directory_entries')
    .upsert(row, { onConflict: 'slug', ignoreDuplicates: true })
    .select('slug');
  if (error) throw error;
  inserted += data.length;
}
console.log(
  `Imported ${inserted} source-labeled directory entries; preserved ${rows.length - inserted} existing entries.`,
);
