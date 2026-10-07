import { markdownResponse, notFoundMarkdown } from '@/lib/agent-responses';

/** The 404 page for Markdown readers. Paths that match no route are
 *  rewritten here when the request asks for text/markdown (next.config.ts),
 *  so the status stays 404 and the body says where to go instead. */
export function GET() {
  return markdownResponse(notFoundMarkdown(), 404, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  });
}
