import { listingBySlug } from '@/lib/server/catalog';
export const dynamic = 'force-dynamic';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const item = await listingBySlug((await params).slug);
  if (!item)
    return Response.json({ error: 'Listing not found.' }, { status: 404 });
  const { sources: _sources, ...listing } = item;
  return Response.json(
    {
      version: '1',
      listing: {
        ...listing,
        url: 'https://ruagentic.com/tools/' + listing.slug,
      },
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
