import seed from '../../data/catalog.json' with { type: 'json' };
import { setTimeout as delay } from 'node:timers/promises';
import {
  aliases,
  CAMPAIGN_ID,
  companyDomain,
  CUTOFF,
  dayKey,
  digest,
  qualify,
  SOURCES,
  type Candidate,
  type Source,
} from './policy.ts';
import { fetchSnapshot, parseDetail } from './sources.ts';
import { readPage } from './http.ts';
import { findContact, resolveHomepage } from './contacts.ts';
import { Smartlead } from './smartlead.ts';
import { discoveryStore, type DiscoveryStore } from './store.ts';
import { object } from './contracts.ts';

type DiscoveryReport = {
  day: string;
  cutoff: string;
  campaignId: number;
  sources: {
    source: Source;
    status: string;
    error?: string;
    observed?: number;
    newCandidates?: number;
    baseline?: boolean;
  }[];
  candidates: Record<
    | 'checked'
    | 'enriched'
    | 'enrolled'
    | 'suppressed'
    | 'skipped'
    | 'uncertain'
    | 'failed',
    number
  >;
  issues: string[];
  mode?: string;
  status?: string;
};

/** Includes submissions/hidden entries so owners already using RUAGENTIC are not prospected. */
export async function directoryAliases(store: DiscoveryStore) {
  const result = new Set(seed.flatMap((i) => aliases(i)));
  for (const [table, field, key] of [
    ['directory_entries', 'data', 'slug'],
    ['submissions', 'payload', 'id'],
  ]) {
    let complete = false;
    for (let offset = 0; offset < 100000; offset += 500) {
      const { data, error } = await store.db
        .from(table)
        .select(field)
        .order(key)
        .range(offset, offset + 499);
      if (error)
        throw new Error(
          'RUAGENTIC duplicate check unavailable; enrichment stopped',
        );
      for (const row of data || []) {
        const listing = object(object(row)[field]);
        if (typeof listing.name === 'string')
          for (const alias of aliases({
            name: listing.name,
            homepage:
              typeof listing.homepage === 'string'
                ? listing.homepage
                : undefined,
            repository:
              typeof listing.repository === 'string'
                ? listing.repository
                : undefined,
            endpoint:
              typeof listing.endpoint === 'string'
                ? listing.endpoint
                : undefined,
          }))
            result.add(alias);
      }
      if (!data || data.length < 500) {
        complete = true;
        break;
      }
    }
    if (!complete)
      throw new Error('RUAGENTIC duplicate check exceeded pagination limit');
  }
  return result;
}
export const duplicate = (item: Candidate, known: Set<string>) =>
  aliases(item).some((a) => known.has(a));
export function dailyLimit() {
  const n = Number(process.env.DISCOVERY_DAILY_LIMIT || 25);
  if (!Number.isInteger(n) || n < 1 || n > 50)
    throw new Error('DISCOVERY_DAILY_LIMIT must be an integer from 1 to 50');
  return n;
}
export async function runDiscovery(
  options: { baselineOnly?: boolean; now?: Date; store?: DiscoveryStore } = {},
) {
  const now = options.now || new Date(),
    day = dayKey(now),
    store = options.store || discoveryStore();
  const owner = await store.claim(day);
  if (!owner) return { status: 'already_running_or_completed', day };
  const deadline = Date.now() + 275_000;
  const report: DiscoveryReport = {
    day,
    cutoff: CUTOFF,
    campaignId: CAMPAIGN_ID,
    sources: [],
    candidates: {
      checked: 0,
      enriched: 0,
      enrolled: 0,
      suppressed: 0,
      skipped: 0,
      uncertain: 0,
      failed: 0,
    },
    issues: [],
  };
  try {
    const sourceDeadline = Math.min(deadline - 90_000, Date.now() + 180_000);
    const results = await Promise.allSettled(
      SOURCES.map(async (source) => {
        const state = await store.source(source);
        const since = state.last_success_at
          ? new Date(
              Math.max(
                Date.parse(CUTOFF),
                Date.parse(state.last_success_at) - 86_400_000,
              ),
            ).toISOString()
          : CUTOFF;
        const snapshot = await fetchSnapshot(
          source,
          sourceDeadline,
          new Set(state.seen_keys),
          since,
        );
        if (!snapshot.complete) {
          await store.sourceError(
            source,
            snapshot.error || 'Incomplete source',
          );
          return { source, status: 'unavailable', error: snapshot.error };
        }
        return {
          source,
          status: 'checked',
          ...(await store.commit(snapshot, state, now.toISOString())),
        };
      }),
    );
    results.forEach((r, i) =>
      report.sources.push(
        r.status === 'fulfilled'
          ? r.value
          : {
              source: SOURCES[i],
              status: 'failed',
              error: 'Source checkpoint could not be saved',
            },
      ),
    );
    const missing = ['PROSPEO_API_KEY', 'SMARTLEAD_API_KEY'].filter(
      (k) => !process.env[k],
    );
    if (
      options.baselineOnly ||
      process.env.DISCOVERY_ENRICHMENT_ENABLED !== 'true' ||
      missing.length
    ) {
      report.mode = 'discovery_only';
      report.issues.push(
        options.baselineOnly
          ? 'Baseline-only run'
          : missing.length
            ? `Missing ${missing.join(', ')}`
            : 'Enrichment is not enabled',
      );
    } else {
      report.mode = 'discovery_and_outreach';
      const known = await directoryAliases(store),
        ledger = await store.outreach();
      const held = ledger.filter((r) =>
        ['reserved', 'uncertain'].includes(r.status),
      ).length;
      if (held)
        report.issues.push(
          `${held} invitation reservations need Smartlead reconciliation before any retry`,
        );
      const contactedDomains = new Set(
          ledger.map((r) => String(r.company_domain)),
        ),
        contactedEmails = new Set(ledger.map((r) => String(r.email)));
      const smartlead = new Smartlead(process.env.SMARTLEAD_API_KEY!, deadline),
        limit = dailyLimit();
      for (const row of await store.pending(100)) {
        if (Date.now() > deadline - 45_000) {
          report.issues.push(
            'Remaining candidates are queued for the next daily run',
          );
          break;
        }
        report.candidates.checked++;
        let item = row.data,
          contact = row.contact;
        try {
          if (item.needsDetail) {
            item = parseDetail(
              item,
              (await readPage(item.sourceUrl, deadline)).text,
            );
          }
          // A later detail-page date can disqualify an apparent new sitemap entry.
          if (
            item.publishedAt &&
            (Date.parse(item.publishedAt) < Date.parse(CUTOFF) ||
              !Number.isFinite(Date.parse(item.publishedAt)))
          ) {
            await store.update(row.id, {
              status: 'skipped',
              reason: 'Detail evidence predates cutoff',
              data: item,
            });
            report.candidates.skipped++;
            continue;
          }
          if (duplicate(item, known)) {
            await store.update(row.id, {
              status: 'already_listed',
              reason: 'Matches a RUAGENTIC listing or submission',
              data: item,
            });
            report.candidates.skipped++;
            continue;
          }
          item = await resolveHomepage(item, deadline);
          const decision = qualify(item),
            domain = companyDomain(item.homepage);
          if (
            !decision.eligible ||
            !domain ||
            duplicate(item, known) ||
            contactedDomains.has(domain)
          ) {
            await store.update(row.id, {
              status: 'skipped',
              reason: !decision.eligible
                ? decision.reason
                : !domain
                  ? 'No independently identifiable company website'
                  : 'Project or company already listed/contacted',
              data: item,
            });
            report.candidates.skipped++;
            continue;
          }
          if (!contact) {
            if (!(await store.budget('prospects', day, limit))) {
              report.issues.push('Daily prospect limit reached');
              break;
            }
            await store.update(row.id, {
              attempts: row.attempts + 1,
              status: 'retry',
              data: item,
            });
            contact = await findContact(item, deadline, () =>
              store.budget('paid_api_calls', day, limit * 4),
            );
            if (!contact) {
              await store.update(row.id, {
                status: 'no_verified_contact',
                reason:
                  'No verified founder or published business contact found',
              });
              report.candidates.skipped++;
              continue;
            }
            await store.update(row.id, { status: 'contact_ready', contact });
            report.candidates.enriched++;
          }
          if (
            contactedEmails.has(contact.email) ||
            (await smartlead.exists(contact.email))
          ) {
            await store.update(row.id, {
              status: 'suppressed',
              reason: 'Email already exists in invitation ledger or Smartlead',
            });
            report.candidates.suppressed++;
            continue;
          }
          if (!(await store.budget('enrollments', day, limit))) {
            report.issues.push('Daily enrollment limit reached');
            break;
          }
          const projectKey = digest(
            aliases(item).find((a) => a.startsWith('repo:')) ||
              `domain:${domain}`,
          );
          if (
            !(await store.reserve(row.id, projectKey, contact, CAMPAIGN_ID))
          ) {
            await store.update(row.id, {
              status: 'suppressed',
              reason:
                'Another source already reserved this project/company/email',
            });
            report.candidates.suppressed++;
            continue;
          }
          contactedDomains.add(domain);
          contactedEmails.add(contact.email);
          // Write uncertainty BEFORE calling the external service. A crash can never re-import blindly.
          await store.update(row.id, {
            status: 'enrollment_uncertain',
            reason: 'Import reserved; awaiting provider acknowledgement',
          });
          let outcome;
          try {
            outcome = await smartlead.import(item, contact);
          } catch {
            outcome = { status: 'uncertain', accepted: 0 };
          }
          await store.completeOutreach(row.id, outcome.status, outcome);
          await store.update(row.id, {
            status:
              outcome.status === 'uncertain'
                ? 'enrollment_uncertain'
                : outcome.status,
            reason:
              outcome.status === 'uncertain'
                ? 'Check this email in the Smartlead campaign before any manual retry'
                : null,
          });
          report.candidates[
            outcome.status === 'enrolled'
              ? 'enrolled'
              : outcome.status === 'suppressed'
                ? 'suppressed'
                : 'uncertain'
          ]++;
          for (const alias of aliases(item)) known.add(alias);
          await delay(2100); // below Prospeo search quota, including on fast project responses
        } catch (error) {
          report.candidates.failed++;
          // Never turn an uncertain external write back into a retryable enrichment job.
          const { data } = await store.db
            .from('discovery_candidates')
            .select('status')
            .eq('id', row.id)
            .single();
          if (data?.status !== 'enrollment_uncertain')
            await store.update(row.id, {
              status: row.attempts >= 2 ? 'needs_review' : 'retry',
              attempts: row.attempts + 1,
              reason:
                error instanceof Error
                  ? error.message.slice(0, 180)
                  : 'Candidate processing failed',
            });
          if (
            /(?:HTTP (401|402|403|423|429)|budget)/.test(
              error instanceof Error ? error.message : '',
            )
          ) {
            report.issues.push(
              'Provider unavailable or budget reached; remaining contacts left queued',
            );
            break;
          }
        }
      }
    }
    report.status =
      report.sources.some((r) => r.status !== 'checked') ||
      report.issues.length ||
      report.candidates.uncertain ||
      report.candidates.failed
        ? 'attention_required'
        : 'completed';
    await store.finish(day, owner, report);
    return report;
  } catch (error) {
    report.status = 'failed';
    report.issues.push(
      error instanceof Error ? error.message.slice(0, 200) : 'Job failed',
    );
    await store.finish(day, owner, report, 'failed');
    return report;
  }
}
