import { catalog } from '@/lib/server/catalog';
import { rateLimit } from '@/lib/server/http';
import { recordInstall } from '@/lib/server/views';
import { validSlug } from '@/lib/views';
export const runtime = 'nodejs';
const CLIENTS = new Set([
  'claude-code',
  'cursor',
  'claude-desktop',
  'codex',
  'windsurf',
  'other',
]);
const done = () => new Response(null, { status: 204 });
/** The CLI's install ping: one count per listing per client per UTC day.
 *  Unknown slugs and over-eager clients are ignored; it never fails. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      slug?: unknown;
      client?: unknown;
    } | null;
    if (!body || !validSlug(body.slug)) return done();
    const client =
      typeof body.client === 'string' && CLIENTS.has(body.client)
        ? body.client
        : 'other';
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    await rateLimit('installs:' + ip, 60, 3600);
    const known = new Set((await catalog()).map((i) => i.slug));
    if (!known.has(body.slug)) return done();
    await recordInstall(body.slug, client);
  } catch {
    /* a counter is never worth an error */
  }
  return done();
}
