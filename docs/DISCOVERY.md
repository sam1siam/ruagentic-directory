# Daily project discovery

The directory checks eleven sources once a day at **11:17 UTC** (07:17 Toronto during daylight saving time, 06:17 in winter). Vercel calls `/api/cron/discovery` with the existing `CRON_SECRET`. This is private prospecting infrastructure, not a public crawler endpoint or a mechanism for automatically publishing directory listings.

## Selection and dates

Only MCP servers, MCP clients, and AI agents qualify. A factual project identity and public project URL are required. Projects already in the bundled directory, database, or a user's submission are excluded before enrichment. Matching uses normalized repositories, company domains, endpoints, and names. The conservative company-level rule allows only one invitation per company, even if it ships several projects.

The permanent cutoff is **September 10, 2026, 00:00 America/Toronto** (`2026-09-10T04:00:00Z`). There is no historical backfill.

| Source | Discovery method | How newness is established |
| --- | --- | --- |
| Official MCP Registry | Public v0.1 API, paginated | Earliest publication across the complete server version history; a new version of an old server is excluded |
| MCP.so | Public server and agent sitemaps, then new detail pages | New URL plus the exact server record's original `createdAt`; sitemap order can change, so absence alone never authorizes outreach |
| PulseMCP | Public sitemap and allowed detail pages | Absent from a previous complete baseline; `lastmod` is ignored |
| Cline | Official published `catalog.json`, MCP entries only | New catalog ID after a complete baseline |
| Docker | Official v3 catalog | Original `dateAdded` |
| Cursor Directory | Public sitemap and allowed detail pages | New URL after a complete baseline; rate limits/bot blocks are recorded and respected |
| Microsoft MCP list | `microsoft/mcp` README | New listed entry after a complete baseline; this repository covers Microsoft's MCP servers |
| LiteLLM | Public `mcp_registry.json` | New catalog ID after a complete baseline; package/registry metadata resolves project links without executing install commands |
| Product Hunt | Public Atom feed | Original `published`, never `updated`; only agent/MCP products qualify |
| Hacker News | Official HN API `showstories` (the latest ~200 Show HN posts, several days' worth) | Original submission `time`; only posts that mention MCP or AI agents qualify |
| GitHub | Repository search API for topics `mcp-server` and `model-context-protocol` | Repository `created_at`; forks and archived repositories are excluded, and a repository without its own website is skipped |

An undated site's first successful full snapshot is a baseline, not a lead list. This deliberately excludes entries already present at setup, including those whose exact publication time cannot be established. Failed, empty, or incomplete full catalogs do not replace a baseline. Source failures leave the other sources operational. A public feed can expose only its current window; an outage longer than that window can miss entries. A site that renames URLs without publication evidence may require manual review. No scraper can guarantee that an undated source's newly appearing URL represents a newly created company.

Public crawling checks robots.txt, uses the identified RUAGENTIC user agent, pins public DNS addresses, caps bytes and time, and never uses browser sessions, executes a submitted command, or bypasses a bot wall. Redirects are followed for up to five hops: every hop must stay on HTTPS, is resolved and pinned to public addresses again, and is checked against the robots.txt of its own origin. A redirecting robots.txt is followed the same way (RFC 9309); one that ends on an ordinary page or a 4xx response imposes no rules.

MCP.so's public server-rendered metadata is parsed as JavaScript syntax without execution, matching the exact server slug and reading only its name and original creation date. Unreadable or conflicting dates are held as `needs_publication_evidence`; old renamed or promoted entries are skipped. Product Hunt's feed currently returns HTTP 403 from Vercel, and Cursor returns HTTP 429. These failures are recorded independently. Product Hunt's [API documentation](https://api.producthunt.com/v2/docs) requires permission for commercial use; API access is not enabled pending that permission.

## Contacts and campaign

The dedicated Smartlead campaign is **3932154**, “RUAGENTIC | New MCP & AI agent listings | Since 2026-09-10”. Its one email introduces ruagentic.com and the Agentic Protocol at ruagentic.org, and explains the actual free path: generate and publish matching `agentic.json`, `agentic.txt`, and README additions, then pass the directory submission checker. It does not promise rankings, endorsement, or automatic approval.

Contact policy: **a founder's work email first, then a published hello@ or support@ address.** Addresses are never guessed.

1. Prospeo founder search on the exact company domain (current titles containing Founder or Co-founder, at most two people), then a verified work-email reveal for each. The returned company, current title and email domain must match, and founder lookups accept only personal mailboxes.
2. If Prospeo names a founder without a verified email, Findymail looks that founder up by name and domain.
3. If Prospeo finds no founder, Findymail searches the company's current founders itself and looks up their emails.
4. If no founder email is found, a hello@ or support@ address on the company's own domain that the homepage or its contact page publishes (hello@ first) is verified through Findymail. Pages that refuse marketing or unsolicited contact are skipped. This step never runs while a Prospeo lookup is unresolved.

A candidate with none of these is recorded as `no_verified_contact` and is never enrolled.

The default ceiling is **50 prospects and 50 enrollments per Toronto calendar day**, with at most 200 paid API attempts across providers. Failed and ambiguous paid calls still consume this internal allowance; provider pricing determines actual credits. No mobile-number enrichment is requested. Missing keys, unavailable duplicate checks, and provider account/quota errors stop dependent work. Projects lacking a verifiable contact are recorded without enrollment.

Smartlead imports retain its global block list, unsubscribe list, bounce suppression, and duplicate checks across other campaigns. The campaign stops on replies, offers unsubscribe, disables click/open tracking, and sends weekdays 09:00–17:00 America/Toronto. Campaign enrollment and campaign activation are separate: a verified sender must be connected before sending starts. The cron never starts a paused campaign or changes existing campaigns/mailboxes.

## Provider limits and work order

Every Prospeo and Findymail call is paced, including empty searches and failures: Prospeo at least 3.1 seconds apart per endpoint group and Findymail 1.1 seconds, slowing further to match Prospeo's `x-second-rate-limit` and `x-minute-rate-limit` headers. A 429, or a minute or daily allowance reaching zero, blocks that provider until its `Retry-After` or reset time. Each outreach run starts with Prospeo's free account check and records the plan, remaining credits and renewal (`prospeo`) plus the pacer's state per provider (`providers`, including requests left today). With no credits left, enrichment pauses and candidates stay queued.

A rate limit, cooldown or account error (HTTP 401, 402, 403, 423 or 429) at Prospeo, Findymail or Smartlead is not the candidate's fault. The candidate returns to the queue with its status and attempt count unchanged and is counted as `deferred`. A short limit is waited out; one that outlasts the run, or any account error, stops outreach for the day with the reason in `issues`. Findymail never substitutes for a rate-limited Prospeo lookup. Only candidate-specific failures count an attempt, and a third failed attempt moves a candidate to `needs_review`.

Work order each run: candidates whose contact is already found, then at most five failed candidates last tried 20 or more hours ago, then new candidates oldest first.

## Deployment and controls

Apply `supabase/migrations/202609100001_discovery.sql`. All four tables are service-role-only with RLS. Configure these **server-side production** environment variables and redeploy:

- `DISCOVERY_ENABLED=true`: enable source collection.
- `DISCOVERY_ENRICHMENT_ENABLED=true`: allow paid enrichment and Smartlead enrollment. Leave false while establishing baselines or completing sender/key setup.
- `DISCOVERY_DAILY_LIMIT=50`: integer 1–50; also update the Smartlead campaign's sending limit when intentionally increasing volume.
- `PROSPEO_API_KEY`, `FINDYMAIL_API_KEY`, `SMARTLEAD_API_KEY`: sensitive credentials. Findymail is optional for founder-only Prospeo operation, but required for the published-contact fallback.
- Existing Supabase URL/secret and `CRON_SECRET`.
- Optional `GITHUB_TOKEN` for public repository API quota. Without it GitHub allows 10 repository searches a minute and 60 other API calls an hour; with it, 30 and 5,000. A GitHub limit holds only the candidate that hit it, never the day's outreach.

The cron has a 300-second maximum. Sources load in the background while the candidates already queued are processed, so a slow source no longer uses up the candidates' time, and it leaves remaining candidates queued when its processing budget is exhausted. Each complete source is checkpointed. The Official MCP Registry reads up to four version histories at a time. It publishes no rate limit and answers bursts with HTTP 429, so a 429 or 503 pauses every reader for 2, 4, 8 then 16 seconds and retries the same read; a server whose read fails is left for the next run, and when time runs short the servers already read and their new candidates are saved (`partial` in the report). Its window start stays put until a complete pass, so the next run lists the same window again and reads only what is left. Partial saving is limited to dated sources; undated sources still establish newness only from a complete snapshot. It has a ten-minute database lease and one completed run per day. A process crash cannot blindly duplicate an invitation: reserve the project/company/email and persist `enrollment_uncertain` before calling Smartlead. Explicitly acknowledged imports become `enrolled` or `suppressed`; unknown outcomes stay held for review.

Turning off enrichment preserves source collection. Turning off discovery stops the job. Pause the dedicated campaign in Smartlead to stop sending immediately; that does not alter other campaigns.

## Monitoring and recovery

Run `npm run discovery:audit` for read-only source checks; this does not write checkpoints, spend credits, or add contacts. For an explicitly authorized local run with real server credentials, use `node --env-file=<private-env-file> scripts/discovery.ts --baseline` or `--run`. Vercel's downloaded environment files redact sensitive values; a downloaded placeholder is not a usable credential.

In the RUAGENTIC Supabase SQL editor:

```sql
select source, item_count, initialized_at, last_success_at, last_error
from public.discovery_sources order by source;
select day, started_at, finished_at, status, report
from public.discovery_runs order by day desc limit 14;
select status, count(*) from public.discovery_candidates group by status;
select id, data->>'name' as project, reason, contact->>'email' as email
from public.discovery_candidates
where status in ('enrollment_uncertain','needs_review') order by first_seen_at;
```

Check the exact email in campaign 3932154 before resolving an uncertain import. If present, mark the candidate and its outreach row `enrolled`. If absent, establish that the original request definitively failed before manually adding it through Smartlead; never reset the reservation and let a retry guess. Suppressed and unsubscribed contacts stay suppressed.

Review `attention_required` reports for source failures, missing keys, limits, and unknown imports. Fix the cause, preserving `seen_keys`, `initialized_at`, and invitation reservations. Do not clear a baseline to “retry”: doing so loses the evidence for newness. The next daily run retries unavailable sources. A completely failed run can reacquire its expired lease; a completed day's job is intentionally not repeatable.

Candidates that failed only because of the redirect handling or Prospeo pacing fixed on September 13, 2026 can go back in the queue. This touches only rows with no found contact and no reserved invitation:

```sql
update public.discovery_candidates as c
set status = 'pending', attempts = 0, reason = null, updated_at = now()
where c.status in ('retry', 'needs_review')
  and (c.reason like 'The URL redirects%' or c.reason like '%returned HTTP 429%')
  and c.contact is null
  and not exists (
    select 1 from public.discovery_outreach o where o.candidate_id = c.id
  );
```

Validation: `npm test`, `npm run typecheck`, `npm run build`, and the transactional `tests/discovery-database.sql` checks. Database fixtures roll back and never invoke an email provider.
