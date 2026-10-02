import { mcp } from '@/lib/server/mcp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Some clients and directory health checks send `Accept: */*` or only
 *  `application/json`; the transport would answer 406. The intent is the
 *  same, so the header is normalised to what the spec asks for. */
function lenient(request: Request) {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('application/json') && accept.includes('text/event-stream'))
    return request;
  const headers = new Headers(request.headers);
  headers.set('accept', 'application/json, text/event-stream');
  return new Request(request, { headers });
}
export const POST = (request: Request) => mcp.fetch(lenient(request));
export const GET = (request: Request) => mcp.fetch(lenient(request));
export const DELETE = (request: Request) => mcp.fetch(lenient(request));
