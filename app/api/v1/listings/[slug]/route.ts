import { listingBySlug } from '@/lib/server/catalog';
export const dynamic = 'force-dynamic';
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
