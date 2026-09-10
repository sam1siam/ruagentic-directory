import { NextResponse } from 'next/server';
import { listingBySlug } from '@/lib/server/catalog';
import { badgeSvg, isVerified } from '@/lib/badge';

export const dynamic = 'force-dynamic';

const svgHeaders = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
};

/** GET /badge/<slug>.svg — the "Listed on RUAGENTIC" badge for a listing. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!file.endsWith('.svg'))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const item = await listingBySlug(file.slice(0, -4));
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(badgeSvg(isVerified(item)), { headers: svgHeaders });
}
