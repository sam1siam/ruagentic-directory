import { listingByAnySlug } from '@/lib/server/catalog';
import { connectPlan } from '@/lib/connect';
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
/** The connection facts a client or the CLI needs, from stored data only:
 *  the published remote or package, required headers and variables, and
 *  the same snippets the listing page shows. */
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
  const plan = connectPlan(item);
  return Response.json(
    {
      version: '1',
      slug: item.slug,
      name: item.name,
      kind: item.kind,
      url: 'https://ruagentic.com/tools/' + item.slug,
      homepage: item.homepage,
      documentation: item.documentation,
      repository: item.repository,
      key: plan.key,
      remote: plan.remote,
      package: plan.pkg,
      agent: plan.agent,
      requiredHeaders: plan.requiredHeaders,
      requiredEnv: plan.requiredEnv,
      authentication: item.authentication,
      transport: item.transport,
      snippets: plan.snippets,
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
