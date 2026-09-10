import { cronAuthorized } from '@/lib/server/http';
import { runDiscovery } from '@/lib/discovery/run';
export const runtime = 'nodejs';
export const maxDuration = 300;
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
    console.info('discovery_run_summary', JSON.stringify(report));
    return Response.json(report, {
      status: report.status === 'failed' ? 503 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Discovery storage is unavailable. No outreach was attempted.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
