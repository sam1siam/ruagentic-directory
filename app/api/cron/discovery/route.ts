import { cronAuthorized } from '@/lib/server/http';
import { runDiscovery } from '@/lib/discovery/run';
import { invalidateCatalog } from '@/lib/server/catalog-cache';
export const runtime = 'nodejs';
// Pro plan ceiling with Fluid compute; lib/discovery/run.ts budgets under it.
export const maxDuration = 800;
export async function GET(request: Request) {
  if (!cronAuthorized(request))
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  if (process.env.DISCOVERY_ENABLED !== 'true')
    return Response.json(
      { status: 'disabled' },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  try {
    const report = await runDiscovery();
    // New listings show up as soon as the cached catalog batches expire.
    if ('candidates' in report && report.candidates.listed > 0)
      invalidateCatalog();
    console.info('discovery_run_summary', JSON.stringify(report));
    return Response.json(report, {
      status: report.status === 'failed' ? 503 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Discovery storage is unavailable. No listing was attempted.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
