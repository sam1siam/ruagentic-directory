import { SOURCES } from '../lib/discovery/policy.ts';
import { fetchSnapshot } from '../lib/discovery/sources.ts';
import { runDiscovery } from '../lib/discovery/run.ts';
if (process.argv.includes('--run') || process.argv.includes('--baseline')) {
  console.log(
    JSON.stringify(
      await runDiscovery({ baselineOnly: process.argv.includes('--baseline') }),
      null,
      2,
    ),
  );
} else {
  // Default is a read-only source audit: no database writes, credits, or contacts.
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const r = await fetchSnapshot(source, Date.now() + 180_000);
      return {
        source,
        complete: r.complete,
        count: r.items.length,
        error: r.error,
      };
    }),
  );
  console.log(
    JSON.stringify(
      results.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : { source: SOURCES[i], error: 'Audit failed' },
      ),
      null,
      2,
    ),
  );
}
