import { catalog } from '@/lib/server/catalog';
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
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = (p.get('q') ?? '').slice(0, 200).toLowerCase(),
    kind = p.get('kind'),
    category = p.get('category');
  const limit = Math.min(
    100,
    Math.max(1, Math.floor(Number(p.get('limit'))) || 20),
  );
  const offset = Math.max(
    0,
    Math.min(5000, Math.floor(Number(p.get('offset'))) || 0),
  );
  const rows = (await catalog())
    .filter(
      (r) =>
        (!kind || r.kind === kind) &&
        (!category || r.category === category) &&
        (!q ||
          [r.name, r.summary, ...r.tags].join(' ').toLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return Response.json(
    {
      version: '1',
      total: rows.length,
      offset,
      limit,
      nextOffset: offset + limit < rows.length ? offset + limit : null,
      listings: rows
        .slice(offset, offset + limit)
        .map(({ sources: _sources, ...r }) => ({
          ...r,
          url: 'https://ruagentic.com/tools/' + r.slug,
        })),
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
