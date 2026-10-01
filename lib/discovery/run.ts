import seed from '../../data/catalog.json' with { type: 'json' };
import {
  aliases,
  companyDomain,
  CUTOFF,
  dayKey,
  qualify,
  SOURCES,
  type Candidate,
  type Source,
} from './policy.ts';
import { fetchSnapshot, parseDetail } from './sources.ts';
import { providerHold, readPage } from './http.ts';
import { providerPacer } from './rate-limit.ts';
import { resolveHomepage } from './homepage.ts';
import { listingFromCandidate } from './listing.ts';
import { discoveryStore, type DiscoveryStore } from './store.ts';
import { object } from './contracts.ts';

type DiscoveryReport = {
  day: string;
  cutoff: string;
  sources: {
    source: Source;
    status: string;
    error?: string;
    observed?: number;
    newCandidates?: number;
    baseline?: boolean;
    partial?: boolean;
  }[];
  candidates: Record<
    'checked' | 'listed' | 'skipped' | 'review' | 'failed' | 'deferred',
    number
  >;
  issues: string[];
  mode?: string;
  status?: string;
  providers?: ReturnType<typeof providerPacer.snapshot>;
};

/** Includes submissions/hidden entries so projects already on RUAGENTIC are not listed twice. */
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
          'RUAGENTIC duplicate check unavailable; listing stopped',
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
  const n = Number(process.env.DISCOVERY_DAILY_LIMIT || 50);
  if (!Number.isInteger(n) || n < 1 || n > 100)
    throw new Error('DISCOVERY_DAILY_LIMIT must be an integer from 1 to 100');
  return n;
}
/** The route's 800-second Vercel ceiling, less a margin for the response. */
export const RUN_BUDGET_MS = 770_000;
export async function runDiscovery(
  options: {
    baselineOnly?: boolean;
    now?: Date;
    store?: DiscoveryStore;
    /** Test seam for the network-facing source reads. */
    snapshot?: typeof fetchSnapshot;
  } = {},
) {
  const now = options.now || new Date(),
    day = dayKey(now),
    store = options.store || discoveryStore();
  const owner = await store.claim(day);
  if (!owner) return { status: 'already_running_or_completed', day };
  const deadline = Date.now() + RUN_BUDGET_MS;
  const report: DiscoveryReport = {
    day,
    cutoff: CUTOFF,
    sources: [],
    candidates: {
      checked: 0,
      listed: 0,
      skipped: 0,
      review: 0,
      failed: 0,
      deferred: 0,
    },
    issues: [],
  };
  let sourceWork: Promise<void> | undefined;
  try {
    // Sources load in the background while the queue that is already saved is
    // processed, so the slowest source cannot eat the candidates' time.
    const sourceDeadline = deadline - 30_000;
    const snapshot = options.snapshot ?? fetchSnapshot;
    sourceWork = Promise.allSettled(
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
        const result = await snapshot(
          source,
          sourceDeadline,
          new Set(state.seen_keys),
          since,
        );
        if (!result.complete) {
          await store.sourceError(source, result.error || 'Incomplete source');
          // A dated source that stopped early keeps what it read; its window
          // stays put, so the next run lists it again and reads only the rest.
          if (result.partial && result.items.length)
            return {
              source,
              status: 'partial',
              error: result.error,
              ...(await store.commitPartial(result, state, now.toISOString())),
            };
          return { source, status: 'unavailable', error: result.error };
        }
        return {
          source,
          status: 'checked',
          ...(await store.commit(result, state, now.toISOString())),
        };
      }),
    ).then((results) =>
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
      ),
    );
    if (
      options.baselineOnly ||
      process.env.DISCOVERY_LISTING_ENABLED === 'false'
    ) {
      report.mode = 'discovery_only';
      report.issues.push(
        options.baselineOnly ? 'Baseline-only run' : 'Listing is not enabled',
      );
    } else {
      report.mode = 'discovery_and_listing';
      const known = await directoryAliases(store),
        slugs = new Set([
          ...seed.map((s) => s.slug),
          ...(await store.listingSlugs()),
        ]),
        limit = dailyLimit();
      // Skips cost nothing against the limit, so the queue is read well past
      // it; the clock and the daily limit decide where the run stops.
      for (const row of await store.pending(limit * 4, now)) {
        if (Date.now() > deadline - 45_000) {
          report.issues.push(
            'Remaining candidates are queued for the next daily run',
          );
          break;
        }
        report.candidates.checked++;
        let item = row.data;
        try {
          if (item.needsDetail) {
            item = parseDetail(
              item,
              (await readPage(item.sourceUrl, deadline)).text,
            );
          }
          if (
            item.source === 'mcp-so' &&
            (!item.publishedAt || !item.dateEvidence)
          ) {
            await store.update(row.id, {
              status: 'needs_publication_evidence',
              reason:
                'MCP.so sitemap changes do not establish a new listing; exact publication date is required',
              data: item,
            });
            report.candidates.skipped++;
            continue;
          }
          // A later detail-page date can disqualify an apparent new sitemap entry.
          if (
            item.publishedAt &&
            (Date.parse(item.publishedAt) < Date.parse(CUTOFF) ||
              !Number.isFinite(Date.parse(item.publishedAt)) ||
              Date.parse(item.publishedAt) > now.getTime())
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
          if (!decision.eligible || !domain || duplicate(item, known)) {
            await store.update(row.id, {
              status: 'skipped',
              reason: !decision.eligible
                ? decision.reason
                : !domain
                  ? 'No independently identifiable project website'
                  : 'Project already listed',
              data: item,
            });
            report.candidates.skipped++;
            continue;
          }
          if (!(await store.budget('listings', day, limit))) {
            report.issues.push('Daily listing limit reached');
            break;
          }
          let listing;
          try {
            listing = listingFromCandidate(item, now.toISOString(), slugs);
          } catch (error) {
            // Malformed source data is held for a person, never published.
            await store.update(row.id, {
              status: 'needs_review',
              reason:
                'Listing data rejected: ' +
                (error instanceof Error
                  ? error.message.slice(0, 160)
                  : 'invalid'),
              data: item,
            });
            report.candidates.review++;
            continue;
          }
          const inserted = await store.publishListing(listing);
          slugs.add(listing.slug);
          for (const alias of aliases(item)) known.add(alias);
          await store.update(row.id, {
            status: inserted ? 'listed' : 'already_listed',
            reason: inserted
              ? `Listed as /tools/${listing.slug}`
              : 'A listing with this address already exists',
            data: item,
          });
          report.candidates[inserted ? 'listed' : 'skipped']++;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message.slice(0, 180)
              : 'Candidate processing failed';
          if (providerHold(error)) {
            // A GitHub rate limit is not the candidate's fault: it goes back
            // in the queue unchanged and keeps its place.
            report.candidates.deferred++;
            await store.update(row.id, {
              status: row.status,
              attempts: row.attempts,
              reason: 'Held: ' + message,
            });
            continue;
          }
          report.candidates.failed++;
          await store.update(row.id, {
            status: row.attempts >= 2 ? 'needs_review' : 'retry',
            attempts: row.attempts + 1,
            reason: message,
          });
        }
      }
    }
    await sourceWork;
    report.providers = providerPacer.snapshot();
    report.status =
      report.sources.some((r) => r.status !== 'checked') ||
      report.issues.length ||
      report.candidates.review ||
      report.candidates.failed ||
      report.candidates.deferred
        ? 'attention_required'
        : 'completed';
    await store.finish(day, owner, report);
    return report;
  } catch (error) {
    if (sourceWork) await sourceWork;
    report.status = 'failed';
    report.issues.push(
      error instanceof Error ? error.message.slice(0, 200) : 'Job failed',
    );
    await store.finish(day, owner, report, 'failed');
    return report;
  }
}
