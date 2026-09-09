import seed from '@/data/catalog.json';
import { prepareCatalog } from '@/lib/catalog-import';
import { cronAuthorized, respond } from '@/lib/server/http';
import { fingerprint } from '@/lib/server/catalog';
import { adminClient, configured } from '@/lib/supabase/server';
import type { PublicListing } from '@/lib/listing';
export const maxDuration = 60;
/** Inserts bundled source-labelled listings the database does not have yet
 *  and refreshes imported rows whose bundled version changed (name,
 *  category, summary, tags or observation date). User submissions and the
 *  visibility flag are never touched. */
export async function GET(request: Request) {
  if (!cronAuthorized(request))
    return new Response('Unauthorized', { status: 401 });
  return respond(async () => {
    if (!configured()) return { inserted: 0, refreshed: 0, unconfigured: true };
    const rows = prepareCatalog(seed) as {
      slug: string;
      data: PublicListing;
    }[];
    const db = adminClient();
    const { data: existing, error } = await db
      .from('directory_entries')
      .select(
        'slug,submitted:data->>submitted,imported:data->>imported,name:data->>name,category:data->>category,summary:data->>summary,observedAt:data->>observedAt,kind:data->>kind,tags:data->tags',
      )
      .limit(5000);
    if (error) throw error;
    const current = new Map(
      (existing ?? []).map((row) => [
        row.slug as string,
        {
          submitted: String(row.submitted) === 'true',
          imported: String(row.imported) === 'true',
          print: fingerprint({
            name: String(row.name ?? ''),
            category: String(row.category ?? ''),
            summary: String(row.summary ?? ''),
            observedAt: String(row.observedAt ?? ''),
            kind: String(row.kind ?? ''),
            tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
          } as PublicListing),
        },
      ]),
    );
    const inserts = rows.filter((r) => !current.has(r.slug));
    const refreshes = rows.filter((r) => {
      const row = current.get(r.slug);
      return (
        row &&
        !row.submitted &&
        row.imported &&
        row.print !== fingerprint(r.data)
      );
    });
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 50) {
      const { data, error } = await db
        .from('directory_entries')
        .upsert(inserts.slice(i, i + 50), {
          onConflict: 'slug',
          ignoreDuplicates: true,
        })
        .select('slug');
      if (error) throw error;
      inserted += data?.length ?? 0;
    }
    let refreshed = 0;
    for (let i = 0; i < refreshes.length; i += 50) {
      const batch = refreshes.slice(i, i + 50).map((r) => ({
        slug: r.slug,
        data: r.data,
        updated_at: new Date().toISOString(),
      }));
      const { data, error } = await db
        .from('directory_entries')
        .upsert(batch, { onConflict: 'slug' })
        .select('slug');
      if (error) throw error;
      refreshed += data?.length ?? 0;
    }
    return { inserted, refreshed, bundled: rows.length };
  });
}
