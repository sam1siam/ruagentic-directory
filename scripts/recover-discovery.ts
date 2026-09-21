// Explicit operator command: node scripts/recover-discovery.ts YYYY-MM-DD
// Reopens only an expired, zero-enrollment run blocked by Findymail HTTP 402.
// Never wired into the normal cron or build; daily budgets and reservations remain intact.
import { discoveryStore } from '../lib/discovery/store.ts';
import { dailyLimit, runDiscovery } from '../lib/discovery/run.ts';
import { CAMPAIGN_ID, dayKey } from '../lib/discovery/policy.ts';
import { apiJson } from '../lib/discovery/http.ts';
import { object } from '../lib/discovery/contracts.ts';

const day = process.argv[2];
if (day !== dayKey(new Date()))
  throw new Error('Explicit current Toronto date required');
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL !==
  'https://efvjfubdvfrzexawpoqb.supabase.co'
)
  throw new Error('Recovery is restricted to the RUAGENTIC directory database');
if (process.env.DISCOVERY_ENRICHMENT_ENABLED !== 'true')
  throw new Error('Production enrichment is not enabled');
const store = discoveryStore();
const { data: prior, error } = await store.db
  .from('discovery_runs')
  .select('*')
  .eq('day', day)
  .single();
if (error || !prior) throw new Error('Could not read previous run');
if (prior.report?.recovery) {
  console.log(
    'discovery_recovery_already_attempted',
    JSON.stringify(prior.report),
  );
} else {
  if (
    prior.status !== 'completed' ||
    !prior.finished_at ||
    Date.parse(prior.lease_until) >= Date.now() ||
    prior.report?.campaignId !== CAMPAIGN_ID ||
    prior.report?.candidates?.enrolled !== 0 ||
    !prior.report?.issues?.some((issue: string) =>
      issue.includes('app.findymail.com returned HTTP 402'),
    )
  )
    throw new Error(
      'Run is not an expired zero-enrollment Findymail credit failure',
    );
  const credits = object(
    await apiJson('https://app.findymail.com/api/credits', {
      headers: { Authorization: 'Bearer ' + process.env.FINDYMAIL_API_KEY },
    }),
  );
  console.log(
    'discovery_recovery_preflight',
    JSON.stringify({
      day,
      dailyLimit: dailyLimit(),
      findymail: {
        credits: credits.credits,
        verifierCredits: credits.verifier_credits,
      },
    }),
  );
  const recovery = {
    requestedAt: new Date().toISOString(),
    previousRun: prior,
  };
  const { data: reopened, error: reopenError } = await store.db
    .from('discovery_runs')
    .update({ status: 'failed', report: { ...prior.report, recovery } })
    .eq('day', day)
    .eq('status', prior.status)
    .eq('owner', prior.owner)
    .eq('finished_at', prior.finished_at)
    .lt('lease_until', new Date().toISOString())
    .select('day');
  if (reopenError || reopened?.length !== 1)
    throw new Error('Run changed; recovery not acquired');
  const finish = store.finish.bind(store);
  store.finish = (runDay, owner, report, status) =>
    finish(
      runDay,
      owner,
      { ...(report as Record<string, unknown>), recovery },
      status,
    );
  const update = store.update.bind(store);
  store.update = async (id, values) => {
    await update(id, values);
    if (values.status && values.status !== 'retry')
      console.log(
        'discovery_recovery_candidate',
        JSON.stringify({ status: values.status, reason: values.reason }),
      );
  };
  const result = await runDiscovery({ store });
  console.log('discovery_recovery_result', JSON.stringify(result));
  if (result.status === 'failed' || !('candidates' in result))
    process.exitCode = 1;
}
