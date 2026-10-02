# Daily project discovery

The directory checks eleven sources once a day at **11:17 UTC** (07:17 Toronto during daylight saving time, 06:17 in winter). Vercel calls `/api/cron/discovery` with the existing `CRON_SECRET`. New MCP servers, MCP clients and AI agents that have their own website, and new skills, plugins, rules files and evals found on GitHub, are published as source-labelled, imported listings, the same way the bundled catalog was built. The project's owner can claim a listing later to correct or complete it.

The earlier founder-outreach stage (Prospeo, Findymail and Smartlead) was retired on October 1, 2026. The job no longer looks up people, sends email, or needs any paid provider.

## Selection and dates

MCP servers, MCP clients, AI agents, skills, plugins, rules files and evals qualify. A factual project identity and public project URL are required. Projects already in the bundled directory, database, or a user's submission are excluded. Matching uses normalized repositories, company domains, endpoints, and names.

The permanent cutoff is **September 10, 2026, 00:00 America/Toronto** (`2026-09-10T04:00:00Z`). There is no historical backfill.

| Source                | Discovery method                                                                                                                                                                                                                | How newness is established                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official MCP Registry | Public v0.1 API, paginated                                                                                                                                                                                                      | Earliest publication across the complete server version history; a new version of an old server is excluded                                                                                                                                               |
| MCP.so                | Public server and agent sitemaps, then new detail pages                                                                                                                                                                         | New URL plus the exact server record's original `createdAt`; sitemap order can change, so absence alone never establishes newness                                                                                                                         |
| PulseMCP              | Public sitemap and allowed detail pages                                                                                                                                                                                         | Absent from a previous complete baseline; `lastmod` is ignored                                                                                                                                                                                            |
| Cline                 | Official published `catalog.json`, MCP entries only                                                                                                                                                                             | New catalog ID after a complete baseline                                                                                                                                                                                                                  |
| Docker                | Official v3 catalog                                                                                                                                                                                                             | Original `dateAdded`                                                                                                                                                                                                                                      |
| Cursor Directory      | Public sitemap and allowed detail pages                                                                                                                                                                                         | New URL after a complete baseline; rate limits/bot blocks are recorded and respected                                                                                                                                                                      |
| Microsoft MCP list    | `microsoft/mcp` README                                                                                                                                                                                                          | New listed entry after a complete baseline; this repository covers Microsoft's MCP servers                                                                                                                                                                |
| LiteLLM               | Public `mcp_registry.json`                                                                                                                                                                                                      | New catalog ID after a complete baseline; package/registry metadata resolves project links without executing install commands                                                                                                                             |
| Product Hunt          | Public Atom feed                                                                                                                                                                                                                | Original `published`, never `updated`; only agent/MCP products qualify                                                                                                                                                                                    |
| Hacker News           | Official HN API `showstories` (the latest ~200 Show HN posts, several days' worth)                                                                                                                                              | Original submission `time`; only posts that mention MCP or AI agents qualify                                                                                                                                                                              |
| GitHub                | Public repository search API for topics `mcp-server`, `model-context-protocol`, `agent-skills`, `claude-skills`, `claude-code-plugin`, `claude-code-plugins`, `cursorrules`, `agents-md`, `agent-benchmark` and `llm-benchmark` | Repository `created_at`; private, internal, unknown-visibility, forked and archived repositories are excluded. A server, client or agent repository without its own website is skipped; a skill, plugin, rules file or eval is listed from its repository |

An undated site's first successful full snapshot is a baseline, not a lead list. This deliberately excludes entries already present at setup, including those whose exact publication time cannot be established. Failed, empty, or incomplete full catalogs do not replace a baseline. Source failures leave the other sources operational. A public feed can expose only its current window; an outage longer than that window can miss entries. A site that renames URLs without publication evidence may require manual review.

GitHub searches use `is:public` and require public repository metadata even when a token can access private repositories. An HTTP 200 response with `incomplete_results: true` saves only partial progress and leaves the source window open for the next run.

Public crawling checks robots.txt, uses the identified RUAGENTIC user agent, pins public DNS addresses, caps bytes and time, and never uses browser sessions, executes a submitted command, or bypasses a bot wall. Redirects are followed for up to five hops: every hop must stay on HTTPS, is resolved and pinned to public addresses again, and is checked against the robots.txt of its own origin. A redirecting robots.txt is followed the same way (RFC 9309); one that ends on an ordinary page or a 4xx response imposes no rules.

MCP.so's public server-rendered metadata is parsed as JavaScript syntax without execution, matching the exact server slug and reading only its name and original creation date. Unreadable or conflicting dates are held as `needs_publication_evidence`; old renamed or promoted entries are skipped. Product Hunt's feed currently returns HTTP 403 from Vercel, and Cursor returns HTTP 429. These failures are recorded independently. Product Hunt's [API documentation](https://api.producthunt.com/v2/docs) requires permission for commercial use; API access is not enabled pending that permission.

## From candidate to listing

Each queued candidate goes through these steps (`lib/discovery/run.ts`):

1. Detail pages are read where the source only listed a URL, and MCP.so entries without an exact publication date are held.
2. Candidates whose publication evidence predates the cutoff are skipped.
3. Candidates that match an existing listing or submission are marked `already_listed`.
4. The project's own website is resolved (`lib/discovery/homepage.ts`): the registry's `websiteUrl`, the npm package's homepage, the GitHub repository's homepage field, or an endpoint origin whose page title names the project. Nothing is guessed. A server, client or agent candidate with no identifiable website is skipped; a skill, plugin, rules file or eval (`packagedCandidate`) uses its repository as its home.
5. The listing is built (`lib/discovery/listing.ts`): name, summary and description from the source's own text plus a plain provenance sentence; homepage, repository and endpoint as found; `imported: true`, `submitted: false`, `ownershipVerified: false`; `source`, `sourceUrl`, `observedAt` and `publishedAt`; and a `sources` trail. The kind (server, client or AI agent) is the source's classification or, failing that, the project's own words; the category is a keyword suggestion with `Other` as the fallback. Both are recorded as editorial normalization, like the bundled catalog, and the owner can correct them by claiming the listing. Pricing, transport, authentication and license stay `unknown` or empty rather than invented.
6. The row is inserted into `directory_entries` (an existing slug is never overwritten), the candidate becomes `listed` with its address in `reason`, and the catalog cache is expired.

Data the listing schema rejects is held as `needs_review`, never published. A GitHub rate limit holds the candidate unchanged (`deferred`); any other failure counts an attempt, and a third failed attempt moves the candidate to `needs_review`.

Work order each run: candidates whose contact lookup had already finished (legacy `contact_ready`), then at most five failed candidates last tried 20 or more hours ago, then new candidates by promise: projects with their own website first, then those that only name a repository, package, registry entry or endpoint (which may still resolve to a website), then GitHub search results without a website; oldest first within each group. Candidates left as `no_verified_contact` by the retired outreach stage are queued again automatically.

## Deployment and controls

Apply `supabase/migrations/202609100001_discovery.sql`. All discovery tables are service-role-only with RLS. The `discovery_outreach` table is no longer written; it can stay for history or be dropped. Configure these **server-side production** environment variables and redeploy:

- `DISCOVERY_ENABLED=true`: run the job at all.
- `DISCOVERY_LISTING_ENABLED` (default `true`): set to `false` to keep collecting sources without publishing listings.
- `DISCOVERY_DAILY_LIMIT=100`: integer 1–100 (default 50), the most listings one Toronto calendar day may publish. Skips do not count.
- Existing Supabase URL/secret and `CRON_SECRET`.
- Optional `GITHUB_TOKEN` for public repository API quota. Without it GitHub allows 10 repository searches a minute and 60 other API calls an hour; with it, 30 and 5,000. GitHub calls are paced and a limit holds only the candidate that hit it.

`PROSPEO_API_KEY`, `FINDYMAIL_API_KEY`, `SMARTLEAD_API_KEY` and `DISCOVERY_ENRICHMENT_ENABLED` are no longer read and can be deleted from Vercel.

The cron has an 800-second maximum (the Pro plan ceiling; the run budgets 770 seconds under it). Sources load in the background while the candidates already queued are processed, so a slow source does not use up the candidates' time, and remaining candidates stay queued when the clock or the daily limit stops the run. Each complete source is checkpointed. The Official MCP Registry reads up to four version histories at a time; a 429 or 503 pauses every reader for 2, 4, 8 then 16 seconds and retries the same read; a server whose read fails is left for the next run, and when time runs short the servers already read and their new candidates are saved (`partial` in the report). Its window start stays put until a complete pass. Partial saving is limited to dated sources; undated sources still establish newness only from a complete snapshot. The job has a ten-minute database lease and one completed run per day.

## Monitoring

Run `npm run discovery:audit` for read-only source checks; this does not write checkpoints or listings. For an explicitly authorized local run with real server credentials, use `node --env-file=<private-env-file> scripts/discovery.ts --baseline` or `--run`.

Run summaries are logged as `discovery_run_summary`; `vercel logs --query discovery_run_summary --json` reads them. In the RUAGENTIC Supabase SQL editor:

```sql
select source, item_count, initialized_at, last_success_at, last_error
from public.discovery_sources order by source;
select day, started_at, finished_at, status, report
from public.discovery_runs order by day desc limit 14;
select status, count(*) from public.discovery_candidates group by status;
select id, data->>'name' as project, reason
from public.discovery_candidates
where status = 'needs_review' order by first_seen_at;
select slug, data->>'name' as name, data->>'kind' as kind, data->>'category' as category
from public.directory_entries
where data->>'source' in ('Official MCP Registry','MCP.so','PulseMCP','Cline Marketplace','Docker MCP Catalog','Cursor Directory','Microsoft MCP list','LiteLLM','Product Hunt','Hacker News (Show HN)','GitHub')
  and (data->>'observedAt') >= '2026-10-01' order by updated_at desc;
```

Review `attention_required` reports for source failures, limits and `needs_review` candidates. Fix the cause, preserving `seen_keys` and `initialized_at`. Do not clear a baseline to "retry": doing so loses the evidence for newness. The next daily run retries unavailable sources. A completely failed run can reacquire its expired lease; a completed day's job is intentionally not repeatable. A listing the job got wrong is handled like any imported listing: hide it from the admin Data health tab, or let the owner claim and correct it.

Validation: `npm test`, `npm run typecheck`, `npm run build`, and the transactional `tests/discovery-database.sql` checks.
