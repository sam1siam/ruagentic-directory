import { catalog } from '@/lib/server/catalog';
import { rateLimit } from '@/lib/server/http';
import { recordView } from '@/lib/server/views';
import { isBot, validSlug } from '@/lib/views';
export const runtime = 'nodejs';
const done = () => new Response(null, { status: 204 });
/** The listing page's view beacon. Counts people, not crawlers; unknown
 *  slugs and over-eager clients are ignored; nothing here can fail a page. */
export async function POST(request: Request) {
  try {
    if (isBot(request.headers.get('user-agent'))) return done();
    const body = (await request.json().catch(() => null)) as {
      slug?: unknown;
    } | null;
    if (!body || !validSlug(body.slug)) return done();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    await rateLimit('views:' + ip, 300, 3600);
    const known = new Set((await catalog()).map((i) => i.slug));
    if (!known.has(body.slug)) return done();
    await recordView(body.slug);
  } catch {
    /* a counter is never worth an error */
  }
  return done();
}
