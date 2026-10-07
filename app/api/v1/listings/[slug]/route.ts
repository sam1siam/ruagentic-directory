import { listingByAnySlug } from '@/lib/server/catalog';
import { problemResponse } from '@/lib/agent-responses';
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
  const found = await listingByAnySlug((await params).slug).catch(
    () => 'unavailable' as const,
  );
  if (found === 'unavailable')
    return problemResponse(
      'directory_unavailable',
      'The directory could not be read.',
    );
  const item = found?.item;
  if (!item) return problemResponse('listing_not_found', 'Listing not found.');
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
