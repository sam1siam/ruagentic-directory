import { NextResponse } from 'next/server';
import { listingBySlug } from '@/lib/server/catalog';
import { cardSvg, embedHtml } from '@/lib/badge';

export const dynamic = 'force-dynamic';

const cache =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

/** GET /embed/<slug>.svg — card image; GET /embed/<slug> — iframe page.
 *  The iframe page may be framed by any site (see next.config headers). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const image = file.endsWith('.svg');
  const item = await listingBySlug(image ? file.slice(0, -4) : file);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(image ? cardSvg(item) : embedHtml(item), {
    headers: {
      'Content-Type': image
        ? 'image/svg+xml; charset=utf-8'
        : 'text/html; charset=utf-8',
      'Cache-Control': cache,
    },
  });
}
