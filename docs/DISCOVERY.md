# Daily project discovery

The directory checks nine sources once a day at **11:17 UTC** (07:17 Toronto during daylight saving time, 06:17 in winter). Vercel calls `/api/cron/discovery` with the existing `CRON_SECRET`. This is private prospecting infrastructure, not a public crawler endpoint or a mechanism for automatically publishing directory listings.

## Selection and dates

Only MCP servers, MCP clients, and AI agents qualify. A factual project identity and public project URL are required. Projects already in the bundled directory, database, or a user's submission are excluded before enrichment. Matching uses normalized repositories, company domains, endpoints, and names. The conservative company-level rule allows only one invitation per company, even if it ships several projects.

The permanent cutoff is **September 10, 2026, 00:00 America/Toronto** (`2026-09-10T04:00:00Z`). There is no historical backfill.

| Source | Discovery method | How newness is established |
| --- | --- | --- |
| Official MCP Registry | Public v0.1 API, paginated | Earliest publication across the complete server version history; a new version of an old server is excluded |
| MCP.so | Public server and agent sitemaps, then new detail pages | Absent from a previous complete baseline; `lastmod` is ignored |
| PulseMCP | Public sitemap and allowed detail pages | Absent from a previous complete baseline; `lastmod` is ignored |
| Cline | Official published `catalog.json`, MCP entries only | New catalog ID after a complete baseline |
| Docker | Official v3 catalog | Original `dateAdded` |
| Cursor Directory | Public sitemap and allowed detail pages | New URL after a complete baseline; rate limits/bot blocks are recorded and respected |
| Microsoft MCP list | `microsoft/mcp` README | New listed entry after a complete baseline; this repository covers Microsoft's MCP servers |
| LiteLLM | Public `mcp_registry.json` | New catalog ID after a complete baseline; package/registry metadata resolves project links without executing install commands |
| Product Hunt | Public Atom feed | Original `published`, never `updated`; only agent/MCP products qualify |

An undated site's first successful full snapshot is a baseline, not a lead list. This deliberately excludes entries already present at setup, including those whose exact publication time cannot be established. Failed, empty, or incomplete full catalogs do not replace a baseline. Source failures leave the other sources operational. A public feed can expose only its current window; an outage longer than that window can miss entries. A site that renames URLs without publication evidence may require manual review. No scraper can guarantee that an undated source's newly appearing URL represents a newly created company.

Public crawling checks robots.txt, uses the identified RUAGENTIC user agent, pins public DNS addresses, caps bytes and time, and never uses browser sessions, executes a submitted command, or bypasses a bot wall.

## Contacts and campaign

The dedicated Smartlead campaign is **3932154**, “RUAGENTIC | New MCP & AI agent listings | Since 2026-09-10”. Its one email introduces ruagentic.com and the Agentic Protocol at ruagentic.org, and explains the actual free path: generate and publish matching `agentic.json`, `agentic.txt`, and README additions, then pass the directory submission checker. It does not promise rankings, endorsement, or automatic approval.

Contact preference:

1. Prospeo founder/owner search for the exact company domain, followed by a verified work-email reveal. The returned current company and role must match.
2. Findymail founder-email lookup when the founder's name is already established.
3. A business contact explicitly published on the project's homepage or contact page, verified through Findymail. Addresses are never guessed. Pages explicitly prohibiting marketing contact are excluded.

The default ceiling is **25 prospects and 25 enrollments per Toronto calendar day**, with at most 100 paid API attempts across providers. Failed and ambiguous paid calls still consume this internal allowance; provider pricing determines actual credits. No mobile-number enrichment is requested. Missing keys, unavailable duplicate checks, and provider account/quota errors stop dependent work. Projects lacking a verifiable contact are recorded without enrollment.

Smartlead imports retain its global block list, unsubscribe list, bounce suppression, and duplicate checks across other campaigns. The campaign stops on replies, offers unsubscribe, disables click/open tracking, and sends weekdays 09:00–17:00 America/Toronto. Campaign enrollment and campaign activation are separate: a verified sender must be connected before sending starts. The cron never starts a paused campaign or changes existing campaigns/mailboxes.

## Deployment and controls

Apply `supabase/migrations/202609100001_discovery.sql`. All four tables are service-role-only with RLS. Configure these **server-side production** environment variables and redeploy:

- `DISCOVERY_ENABLED=true`: enable source collection.
- `DISCOVERY_ENRICHMENT_ENABLED=true`: allow paid enrichment and Smartlead enrollment. Leave false while establishing baselines or completing sender/key setup.
- `DISCOVERY_DAILY_LIMIT=25`: integer 1–50; also update the Smartlead campaign's sending limit when intentionally increasing volume.
- `PROSPEO_API_KEY`, `FINDYMAIL_API_KEY`, `SMARTLEAD_API_KEY`: sensitive credentials. Findymail is optional for founder-only Prospeo operation, but required for the published-contact fallback.
- Existing Supabase URL/secret and `CRON_SECRET`.
- Optional `GITHUB_TOKEN` for public repository API quota.

The cron has a 300-second maximum, checkpoints each complete source, and leaves remaining candidates queued when its processing budget is exhausted. It has a ten-minute database lease and one completed run per day. A process crash cannot blindly duplicate an invitation: reserve the project/company/email and persist `enrollment_uncertain` before calling Smartlead. Explicitly acknowledged imports become `enrolled` or `suppressed`; unknown outcomes stay held for review.

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

Validation: `npm test`, `npm run typecheck`, `npm run build`, and the transactional `tests/discovery-database.sql` checks. Database fixtures roll back and never invoke an email provider.
