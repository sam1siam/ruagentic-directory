import seed from '@/data/catalog.json';
import { prepareCatalog } from '@/lib/catalog-import';
import { cronAuthorized, respond } from '@/lib/server/http';
import { adminClient, configured } from '@/lib/supabase/server';
export const maxDuration = 60;
/** Inserts bundled source-labelled listings the database does not have yet.
 *  Existing rows, including hidden ones, are never touched. */
export async function GET(request: Request) {
  if (!cronAuthorized(request))
    return new Response('Unauthorized', { status: 401 });
  return respond(async () => {
    if (!configured()) return { inserted: 0, unconfigured: true };
    const rows = prepareCatalog(seed);
    const db = adminClient();
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const { data, error } = await db
        .from('directory_entries')
        .upsert(rows.slice(i, i + 50), {
          onConflict: 'slug',
          ignoreDuplicates: true,
        })
        .select('slug');
      if (error) throw error;
      inserted += data?.length ?? 0;
    }
    return { inserted, bundled: rows.length };
  });
}
