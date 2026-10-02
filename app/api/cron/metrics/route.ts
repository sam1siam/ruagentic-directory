import { cronAuthorized, respond } from '@/lib/server/http';
import { metricsReady, refreshMetrics } from '@/lib/server/metrics';
export const runtime = 'nodejs';
export const maxDuration = 300;
/** Hourly: refresh public GitHub repository metrics for the leaderboards,
 *  oldest first. Without GITHUB_TOKEN the API allows 60 calls an hour, so
 *  the batch stays small; with a token the whole directory refreshes daily. */
export async function GET(request: Request) {
  if (!cronAuthorized(request))
    return new Response('Unauthorized', { status: 401 });
  return respond(async () => {
    if (!(await metricsReady()))
      return {
        status: 'not_ready',
        note: 'Apply supabase/migrations/202610010001_listing_metrics.sql',
      };
    const limit = process.env.GITHUB_TOKEN ? 300 : 50;
    const summary = await refreshMetrics(limit, Date.now() + 280_000);
    console.info('metrics_run_summary', JSON.stringify(summary));
    return summary;
  });
}
