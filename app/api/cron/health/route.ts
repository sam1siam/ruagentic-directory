import { cronAuthorized } from '@/lib/server/http';
import { runHealthBatch } from '@/lib/server/health';
export const runtime = 'nodejs';
export const maxDuration = 120;
/** Scheduled fact check: verifies a batch of bundled listings' links,
 *  repositories and registry records and stores the results for the admin
 *  Data health tab. Nothing is hidden automatically; a reviewer decides. */
export async function GET(request: Request) {
  if (!cronAuthorized(request))
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const result = await runHealthBatch(40);
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message.slice(0, 200) },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
