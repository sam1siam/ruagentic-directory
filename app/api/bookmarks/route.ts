import { z } from 'zod';
import {
  respond,
  signedIn,
  sameOrigin,
  body,
  rateLimit,
} from '@/lib/server/http';
import { userClient } from '@/lib/supabase/server';
export async function GET() {
  return respond(async () => {
    await signedIn();
    const { data, error } = await (
      await userClient()
    )
      .from('bookmarks')
      .select('slug');
    if (error) throw error;
    return { slugs: data.map((row) => row.slug) };
  });
}
async function change(request: Request, remove: boolean) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('bookmark:' + user.id, 100);
    const { slug } = z
      .object({ slug: z.string().regex(/^[a-z0-9-]{1,150}$/) })
      .parse(await body(request));
    const db = await userClient();
    const { error } = remove
      ? await db
          .from('bookmarks')
          .delete()
          .eq('owner_id', user.id)
          .eq('slug', slug)
      : await db
          .from('bookmarks')
          .upsert(
            { owner_id: user.id, slug },
            { onConflict: 'owner_id,slug', ignoreDuplicates: true },
          );
    if (error) throw error;
    return { saved: !remove };
  });
}
export const POST = (request: Request) => change(request, false);
export const DELETE = (request: Request) => change(request, true);
