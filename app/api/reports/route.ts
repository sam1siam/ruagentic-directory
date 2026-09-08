import { z } from 'zod';
import {
  respond,
  signedIn,
  sameOrigin,
  body,
  rateLimit,
  HttpError,
} from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('report:' + user.id, 10);
    const input = z
      .object({
        slug: z.string().regex(/^[a-z0-9-]{1,150}$/),
        reason: z.string().trim().min(10).max(2000),
      })
      .strict()
      .parse(await body(request));
    const db = adminClient();
    const { data } = await db
      .from('directory_entries')
      .select('slug')
      .eq('slug', input.slug)
      .eq('visible', true)
      .maybeSingle();
    if (!data) throw new HttpError(404, 'Listing not found.');
    const { error } = await db
      .from('listing_reports')
      .insert({ owner_id: user.id, ...input });
    if (error) throw error;
    return { received: true };
  });
}
