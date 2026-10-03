# Directory deployment and operations

## Separate resources

Use the `ruagentic-directory` Vercel project and `sam1siam/ruagentic-directory` repository. The convention in `../org` keeps its existing deployment, database, and npm package. This directory does not charge for ruagentic.org.

## Supabase

Create the directory database in the RUAGENTIC organization. Apply the SQL migration and run the seed script. Configure public URL `https://ruagentic.com`, confirmed email registration, secure email changes, and callbacks `/auth/callback`, `/auth/confirm`, and `/reset-password`. Do not permit arbitrary redirect hosts.

Configure custom SMTP with the verified Resend sending domain before opening registration. The default Supabase email service is not a public production email setup. Enable appropriate auth rate limits and monitor delivery. Keep database/service keys server-only; use the publishable key in browser code. RLS remains enabled on all exposed tables.

Set the minimum password length to 12 characters, matching the signup and reset forms. Use `smtp.resend.com`, port `465`, username `resend`, sender `notifications@mail.ruagentic.com`, and sender name `RUAGENTIC`. Store a separate Resend key named `RUAGENTIC auth SMTP`, restricted to sending from `mail.ruagentic.com`, as the SMTP password. Keep that key in Supabase only. The app's listing-email key stays in Vercel. Custom SMTP initially allows 30 auth emails per hour; review capacity and delivery before raising that limit.

Use these Supabase email templates with Site URL `https://ruagentic.com`. They use the existing token-hash confirmation route so opening an email on another device does not require the original browser's PKCE verifier. Keep email link tracking disabled. Test actual email receipt, confirmation, and recovery after configuring the domain.

GitHub uses the **RUAGENTIC** OAuth application owned by the verified [`ruagentic` organization](https://github.com/ruagentic), configured only in this directory's Supabase GitHub provider. Manage the existing app in [organization OAuth settings](https://github.com/organizations/ruagentic/settings/applications/3844012). Its ownership transfer preserved the client ID and secret; no Supabase credential change is required. Homepage: `https://ruagentic.com`. GitHub callback: `https://efvjfubdvfrzexawpoqb.supabase.co/auth/v1/callback`. Keep wildcard callbacks, device flow, and email-optional authentication disabled. The app requests no additional GitHub scopes. GitHub login identifies an account; it does not verify repository ownership.

Supabase redirect allowlist: `https://ruagentic.com/auth/callback`, `https://ruagentic.com/auth/confirm`, `https://ruagentic.com/reset-password`, `https://ruagentic.com/submit**`, `https://ruagentic.com/dashboard**`, and `https://ruagentic.com/auth/callback**`. The final three preserve query parameters. The application independently limits continuation to dashboard, submission, or password reset paths on the canonical origin.

Magic links use `signInWithOtp` with account creation enabled. Email redirects contain the final page, while GitHub uses the PKCE callback. Both templates below are required: new/unconfirmed email users receive signup confirmation, and returning users receive the magic-link email. HTTPS sessions use Secure cookies with SameSite=Lax. Never switch OAuth cookies to SameSite=Strict.

Signup subject: `Confirm your RUAGENTIC email address`

```html
<h2>Welcome to RUAGENTIC</h2>
<p>Confirm your email address to save tools and manage your listings.</p>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next={{ .RedirectTo }}"
    >Continue to RUAGENTIC</a
  >
</p>
<p>If you did not request this account, you can ignore this email.</p>
```

Magic-link subject: `Your RUAGENTIC sign-in link`

```html
<h2>Sign in to RUAGENTIC</h2>
<p>
  Continue using the secure link below. It expires in one hour and can be used
  once.
</p>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next={{ .RedirectTo }}"
    >Continue to RUAGENTIC</a
  >
</p>
<p>If you did not request this link, you can ignore this email.</p>
```

Reset subject: `Reset your RUAGENTIC password`

```html
<h2>Reset your password</h2>
<p>A password reset was requested for your RUAGENTIC account.</p>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/reset-password"
    >Choose a new password</a
  >
</p>
<p>
  If you did not request this reset, you can ignore this email. Your password
  will stay the same.
</p>
```

Confirmation links are single-use. Opening a link displays an explicit confirmation button; GET and HEAD do not consume the token. The button posts to the same-origin confirmation route before creating a session. Keep `Referrer-Policy: strict-origin` on this form: it strips token-bearing paths while retaining the Origin header needed for form validation. Include scanner-prefetch behavior in account-email validation. See [Supabase's email-prefetching guidance](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching).

## Sponsorships

`/advertise` sells monthly placements through Stripe Checkout in subscription mode: Top bar (US$999, the sponsor bar on every page, linking straight to the sponsor's site with `ref=ruagentic.com`), Featured card (US$499, the first card on the chosen category pages, the kind pages and the home page plus a tile on listing detail pages in those categories; one category included, each extra US$50 a month) and Top bar + featured card (US$1,299). Create recurring monthly prices in the RUAGENTIC Stripe account and put their ids in `STRIPE_AD_PRICE_BAR`, `STRIPE_AD_PRICE_CARD`, `STRIPE_AD_PRICE_BOTH` and `STRIPE_AD_PRICE_CATEGORY` (the US$50 extra, added as a second line item with the number of extra categories as quantity). Until they are set, the page renders but checkout answers 503 with a contact prompt.

What happens after payment: Stripe redirects to `/advertise/thanks`, which reads the session and records the order; the `checkout.session.completed` webhook records it too (idempotent on the session id), so the placement is live on the next request. The first recording also sends two emails through the mail provider with per-session idempotency keys: a confirmation to the sponsor with the sponsor page link and what they bought, and a notification to `ADS_NOTIFY_EMAIL` when set. Stripe sends the receipt and the billing portal link. `customer.subscription.updated` and `customer.subscription.deleted` must be added to the webhook endpoint so a lapsed or cancelled subscription flips the order out of `active` and the placement disappears. Apply `supabase/migrations/202609080003_ad_orders.sql`; `ad_orders` is written only by the webhook and the thank-you reconciliation.

Rejecting has two forms: "ask to amend" keeps the subscription (the sponsor has already paid the first month at checkout), emails the review note as what to change, and lets the sponsor edit and resend from the dashboard; "reject & refund" cancels the subscription immediately and refunds the latest payment through Stripe, which needs Invoices (read) and Refunds (write) on the restricted key in addition to Subscriptions (write). If Stripe refuses, the admin tab says so and the refund is done in the Stripe dashboard.

Cards and tiles open the sponsor's page at `/sponsors/<slug>` (noindex), which carries the outbound link; the house sponsor's card opens its directory listing instead. Paid sponsors take a slot ahead of the house sponsor and rotate every ten minutes within a placement. Slots no paid sponsor covers show the house sponsor defined in `lib/advertising.ts` (AstroFabric, whose description is taken from its own product wording).

Sponsorship never affects ordering, source labels or Agentic Protocol checks, and every placement is labelled as sponsored.

## Sponsor self-service

Buying a placement requires a signed-in, confirmed account; the order stores the buyer (`ad_orders.owner_id`, migration 202609080005) and orders paid earlier are claimed by the confirmed email that paid. The dashboard shows every sponsorship with its state, monthly amount and renewal date (read live from Stripe), and offers: Manage billing (a Stripe Customer Portal session: card, invoices, cancel; the portal must be enabled in Stripe with cancellation allowed), Edit creative (tagline, description, button label, categories) and Buy another placement. Edits to a live creative are stored in `pending` and the live version stays up until a reviewer approves them from the Sponsorships tab; edits to an order still in review replace it in place. Category changes are charged or credited the moment the sponsor saves them (the subscription's extra-category line, `STRIPE_AD_PRICE_CATEGORY`, is created, updated or removed with proration); the wording still waits for review, and rejecting pending changes reverts the line to the live categories. Orders without a Stripe customer (demo orders) show no billing button.

Lifecycle: an unpublished (withdrawn) listing answers 404 with a page saying it is unavailable, never a redirect, because the owner can republish under the same slug; a deleted listing is removed with its page, bookmarks and payment attempts (Stripe keeps the payment record) while reports survive, and a later re-listing gets a new slug. A cancelled sponsorship stays live until the paid period ends, then the webhook marks it cancelled: the bar, card and tile slots go to the next paid sponsor or the house sponsor and the sponsor page answers 404; sponsored cards are slots, not listings, so nothing "becomes unsponsored" and any directory listing the sponsor has is untouched. The restricted Stripe key needs Checkout Sessions (write), Billing Portal sessions (write), Customers (read) and Subscriptions (write).

## Admin

`/admin` is the review console: it requires a confirmed Supabase sign-in whose email is listed in `ADMIN_EMAILS` (default `hello@ruagentic.com`); anyone else gets a 404. Tabs: Overview (accounts created, free and paid listings, submissions and sponsorship orders for today, 7 and 30 days and all time, a daily chart, and the admin action log), Sponsorships (every order with all fields; approve, reject with a note that is emailed, or return to the queue), Submissions (by day range and route, with suspend/restore), Accounts (creations with confirmation state and listing counts), Reports (open and closed listing reports), Email (the confirmation outbox with retry), Data health and Duplicates (listings sharing a homepage or repository, with merge and keep-apart decisions).

Sponsorships render only when `approval = 'approved'` and the subscription is active; sponsors are told to expect a decision within 24–48 hours. Every admin action is written to `admin_actions`. Apply `supabase/migrations/202609080004_admin.sql`.

To create or reset the admin account without putting a password in the repository, call the bootstrap endpoint with the cron secret (the address must be in `ADMIN_EMAILS`):

```
curl -X POST https://ruagentic.com/api/admin/bootstrap \
  -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"email":"hello@ruagentic.com","password":"<at least 12 characters>"}'
```

Signing up through `/login` with that address works too; the account only needs to be confirmed.

## Data health (scheduled fact checks)

`/api/cron/health` runs every three hours (Vercel cron, `CRON_SECRET`) and checks 40 bundled listings that were checked longest ago: homepage, documentation and repository links (HEAD, then GET; 403/429 count as bot walls, not failures), the MCP endpoint (GET; 401/405/406 mean it exists), the GitHub repository (missing, archived, renamed, no commits for 18 months; set `GITHUB_TOKEN` for a higher API quota) and the Official MCP Registry record (missing or newer version). Results land in `listing_checks`; the whole catalog cycles in about two days. Nothing is hidden automatically. The admin Data health tab lists broken and warning listings with recheck and hide/show; hiding writes `catalog_overrides`, which the public catalog applies on every request. Fixing the data itself still happens in `data/catalog.json`; the seed cron refreshes imported database rows whenever a bundled entry's name, category, summary, tags or observation date changes, and never touches user submissions. Migration `202609080007_listing_health.sql`.

## Catalog

`data/catalog.json` bundles source-labelled listings. The public catalog merges database rows with bundled entries the database has not stored yet, and the hourly `/api/cron/seed` cron inserts those rows (never touching existing ones) so bookmarks and reports can reference them.

Public catalog reads use Next.js's shared data cache with a five-minute revalidation interval. Database rows are cached in batches of 100 to stay below the per-entry cache size limit; hidden rows retain only their slug so bundled entries cannot bring them back. Publication, withdrawal, payment fulfillment/revocation, admin hide/restore, merges, demo removal, and seed writes expire the `public-catalog` tag. Account data and publication/duplicate-review decisions are not shared through this cache. Failed visibility lookups fail closed rather than serving unchecked bundled data.

Direct SQL changes and standalone seed-script writes rely on the time-based refresh, which occurs on the next request after the interval (the first request can receive stale data during background refresh). Existing public REST response caching is separate and can retain a response for its advertised cache lifetime.

Run `npm run test:catalog-cache` with no other Next development server running in this checkout. It starts a local Next development server and a loopback Supabase fixture with dummy credentials, and checks cross-request reuse, mutation invalidation, hidden-listing fallback, restoration, and error recovery without contacting production services.

## Stripe

Use the separate RUAGENTIC Stripe account (formerly Superway) in Vertex Innovation Collective. Do not use AstroFabric's account or credentials. The application key needs Checkout Sessions write access and Payment Intents, Prices, and Products read access. Connected-account permissions and all other resource permissions stay disabled.

Create one product, RUAGENTIC directory listing, and a **non-recurring US$49.99** price. Put its exact price ID in `STRIPE_PRICE_ID`. Configure the public business name, support email, website, terms URL, and receipt delivery before enabling live charges.

Register `https://ruagentic.com/api/webhooks/stripe` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`

Use the endpoint’s matching live signing secret. Test mode keys and signatures must remain separate. The browser never establishes payment status. Fulfillment validates the retrieved session, line item, price, amount, currency, mode, revision, and internal attempt ID, then commits publication and email together.

Sessions and PaymentIntents carry `app=ruagentic-directory` metadata. Ignore unrelated signed checkout events. For refunds and disputes, retrieve the original PaymentIntent to identify directory payments before writing revocations; disputes do not inherit that metadata. Provider lookup failures must retry. Checkout uses RUAGENTIC branding and its own terms link.

Interrupted creation reuses the persisted attempt’s Stripe idempotency key and stable request parameters. If the key’s safe retry window has passed without a stored provider session, reconcile that attempt with Stripe before authorizing another charge. Never mark an ambiguous payment failed solely because the browser lost its response.

A refunded or disputed payment is durably recorded even if its webhook precedes the success event. Affected paid listings are hidden. Resolve legitimate disputes and restore listings through a reviewed database operation; a dispute outcome does not automatically restore a removed page.

## Resend

Verify `mail.ruagentic.com`. `RESEND_FROM` identifies the sender; `SUPPORT_EMAIL` must be a monitored inbox. Use a sending-only domain-scoped API key. Confirmation messages are queued in the publication transaction and attempted after the response. The protected cron runs every ten minutes and drains outstanding jobs with the same provider idempotency key; each worker also waits for the first 30-second retry inside its own invocation. Jobs that remain unconfirmed 23 hours after their first attempt become `uncertain` and need a manual provider check before any resend.

The intended support address is `hello@ruagentic.com`, using Spaceship's free forwarding to the owner's selected existing inbox. Preserve Spaceship's root receiving MX records alongside Resend's sending records on the `mail` subdomain. Set `SUPPORT_EMAIL` after receiving is verified; confirmation messages use it as Reply-To. Forwarding is an address for receiving mail, not a standalone mailbox or an SMTP account.

The email outbox stores the exact provider request and stable idempotency key. Workers use expiring leases and fencing tokens. Attempts stop before the provider’s 24-hour deduplication window expires. Rows marked `uncertain` require provider reconciliation; do not reset them blindly to pending. Publication remains live if email is delayed.

## DNS and release

Keep Spaceship nameservers unless deliberately migrating the full zone. Add only the exact Vercel apex/www records and Resend DNS records returned for this directory. Preserve unrelated domain and mail records. Redirect `www.ruagentic.com` to the canonical apex before testing cookies and forms.

Set every variable in `.env.example` for production. `node scripts/check-environment.ts` checks presence and basic production identity without printing secrets. After deployment, verify provider health, confirmed signup/reset, free publication, Stripe test transactions/webhooks, email receipt, public URL, and RLS isolation. Production charging requires a live, activated Stripe account.

## Moderation and account requests

Review `listing_reports` through the private Supabase dashboard. For corrections, retain source evidence. Suspend by hiding the public entry and setting its submission state to `suspended` in one transaction. Do not treat a payment or file audit as ownership proof. Handle ownership transfers only after independent account-bound evidence; the public submission flow does not grant imported-entry ownership.

Account deletion requests require checking retention obligations and removing the Auth user through privileged account administration. Do not collect sensitive account information through public issues.

## Validation scope

Local SQL/RLS/concurrency tests can run in an isolated, labeled PostgreSQL container. They do not prove Supabase Auth email delivery, live Stripe activation, Resend delivery, DNS, or browser behavior. WebMCP has a feature-detected browser integration; record a real supported-context check before claiming browser tool verification.

## Submission autofill

`POST /api/import` requires a confirmed account, same-origin request, and an account-based rate limit. It returns suggestions, field-level source URLs, read/failure observations, and missing details. It does not publish a listing or grant ownership/file eligibility.

The importer makes at most six credential-free HTTPS GET requests, two concurrently, within 24 seconds. The first website read can use 512 KiB and the other reads 96 KiB each (992 KiB maximum). DNS resolution rejects every nonpublic address and pins the connection; redirects require the final public URL, and no remote tools or installation commands are executed. Public pages, JSON-LD, GitHub metadata and READMEs, linked docs, llms.txt, OpenAPI, and Agentic profiles can supply suggestions. An inaccessible optional document does not discard successful metadata. Authentication and pricing remain unspecified unless the submitter supplies them.

Imported values remain editable. Re-import preserves touched fields, including deliberately cleared fields, and presents individual alternatives. Applying a suggestion invalidates the previous audit and consent. An open checkout locks editing and re-import. The preview displays Saved only after persistence and Passed only for the current, unexpired server audit.

Before release, test new and returning magic-link users, cross-device email confirmation, expired/replayed links, GitHub success/cancellation/back navigation, sign-out, and persistence of the selected paid/free option through authentication. The automated suite verifies return URL restrictions, scanner GET/HEAD behavior, explicit POST, callback failure paths, source handling, import budgets, and edit preservation; real provider completion is a separate check.

## Badges and embeds

`/badge/<slug>.svg` serves a 28px badge, `/embed/<slug>.svg` a 480×150 card image and `/embed/<slug>` a self-contained HTML card for iframes. All three are generated in `lib/badge.ts` from the stored listing fields and cached publicly for a day. The "Agentic Protocol verified" wording appears only when the published entry carries `agenticCheckedAt`, i.e. it was published through the publication checker; paid and imported listings read "Listed on RUAGENTIC". Listing pages and the dashboard show copy-paste Markdown and HTML (`components/badge-kit.tsx`).

`next.config.ts` exempts `/embed/` from `X-Frame-Options: DENY` and sets `frame-ancestors *` plus `X-Robots-Tag: noindex` there; every other route keeps the framing block. `scripts/check-site.ts` checks both.

## Social images, icons and page metadata

`lib/server/og.tsx` renders the Open Graph and Twitter images with `next/og` in the HUD style; `app/opengraph-image.tsx` covers the site, `app/{servers,clients,ai-agents,skills}/`, `app/categories/[slug]/` and `app/tools/[slug]/` carry their own (listing images show the name, type, category, summary and the "Agentic Protocol verified" chip only when `agenticCheckedAt` is set). Images revalidate hourly. Fonts are fetched from Google Fonts once per server instance; when that fetch fails the built-in font is used, so an image is always returned.

The root layout sets `openGraph` (type, site name, locale) and `twitter` (large card) without titles so every page's own title and description are inherited; pages set `alternates.canonical`. Icons follow the App Router file conventions: `app/icon.svg`, `app/favicon.ico` (16/32/48), `app/apple-icon.png` (180) and `app/manifest.ts` pointing at `public/icon-192.png` and `public/icon-512.png`. Regenerate the raster icons from the SVG mark when the mark changes; `scripts/check-site.ts` checks that all of them are served.

## Structured data, llms-full.txt and security.txt

`lib/seo.ts` builds the JSON-LD blocks: WebSite (with the search action) and Organization on the home page, BreadcrumbList and ItemList on the type and category pages, and SoftwareApplication plus BreadcrumbList on listing pages. `components/json-ld.tsx` renders them. Only stored fields are emitted; there are no ratings, review counts or invented affiliations.

`/llms-full.txt` (app/llms-full.txt/route.ts) is `public/llms.txt` followed by every category and every public listing, regenerated hourly from the catalog. `public/.well-known/security.txt` follows RFC 9116; its `Expires` line must be moved forward before it lapses (currently September 2027).

## Duplicates

A project is identified by its homepage's service identity (origin, or the repository path for GitHub homepages) and its normalised repository path (`lib/duplicates.ts`); "www." is ignored. Within one account the database already refuses a second submission for the same identity. Across the directory:

- Saving or opening a submission returns `duplicates`, and the form warns which existing listing matches and what publishing will do.
- Publishing is refused with HTTP 409 when another account's listing for the same project passed the publication checker (that check proves control of the domain).
- An imported entry is replaced automatically only with proof of control, checked by code at publish time (`publishSubmission`): the checker verified the exact site the import points at (free path, `claimMergeable`), or the publisher signed in with GitHub as the owner, or a public member of the organisation, of the repository the import is about (`sameRepository` + `controlsRepository`, any path). Merging is `mergeListing`: hidden everywhere, `listing_redirects` row, admin action `listing.merge` by `system`. Without proof both listings stay and nothing waits for a person; listings other people paid for are never merged automatically. Imported listings carry a "Claim this listing" button that opens the submit form pre-filled (`listingInputFrom`).
- The admin Duplicates tab lists every group of visible listings sharing a key; "Keep this one" merges the rest into it, "Keep all as different projects" records dismissals in `duplicate_dismissals`.
- A merged slug keeps working: listing pages answer with a permanent redirect, and the API, badge, card and social-image routes resolve it to the survivor.

Apply `supabase/migrations/202609080008_duplicates.sql`; until then merges and dismissals fail and the tab says so, while detection and the publish refusal still work.

## Listing kinds

Seven kinds share one schema (`lib/listing.ts` `kinds`): `server`, `client`, `product` (AI agents), `skill`, `plugin`, `rules` and `eval`. The last four are "packaged" kinds: a published file or package rather than a running service. They use `fileUrl` for the main file (SKILL.md, the plugin manifest, the rules file, the dataset or results; label per kind in `fileLabel`) and `allowedTools` for the tools a skill or plugin pre-approves; a packaged listing needs `fileUrl` or a repository. Older skill rows may still carry `skillFile`; readers fall back to it. Each kind has a browse page from `components/kind-page.tsx`, a home section, a sponsor-card placement, a "package" section and an install guide on the detail page, and a Type button on the submit form. Adding a kind means `lib/listing.ts`, `lib/categories.ts` (`kinds` and `featured`), `lib/server/stats.ts`, an `app/<slug>` folder, and the enumerations in `components/site-shell.tsx`, `app/sitemap.ts`, `lib/webmcp.ts`, `lib/server/mcp.ts`, `app/api/import/route.ts`, `public/openapi.json`, `public/llms.txt` and `scripts/check-site.ts`.

## Leaderboards

`/leaderboards` and `/leaderboards/<kind slug>` rank listings by the one public signal the directory collects: GitHub stars. `app/api/cron/metrics` runs hourly (`50 * * * *`), reads the oldest-collected repositories first through GitHub's repository API (paced by the discovery pacer; 50 a run without `GITHUB_TOKEN`, 300 with it, so set the token for daily full refreshes) and upserts `listing_metrics` (stars, forks, watchers, open issues, last push, collection time; a gone or private repository is recorded with an error and never ranks). Apply `supabase/migrations/202610010001_listing_metrics.sql` first; until then the cron answers `not_ready` and the pages say the first collection has not run. The pages state the collection date, that stars measure attention rather than quality, that listings without a public GitHub repository are not ranked, and that sponsorship never changes a rank. Each board has two tabs: **Top** (stars) and **Fastest since launch** (`?by=pace`: stars divided by the repository's age in days, from the `created_at` column added by `202610020001_listing_metrics_created.sql`; repositories under 14 days old or 10 stars are left out). Ranking is pure (`lib/leaderboard.ts`, unit-tested); the data layer is `lib/server/metrics.ts` with a 10-minute cache expired after each refresh.

## Browse and leaderboard filters

The browse pages (home, kind pages, category pages) and the per-kind leaderboards share one filter model in `lib/browse.ts`: search, type, category, launched (the repository's creation date from `listing_metrics`; projects without a public GitHub repository are not dated and never pass a launch filter), stars, forks, pricing, "Agentic Protocol checked", works-with platform, and for servers transport and authentication; sorts add most stars, most forks and newest launch. Filters live in the query string (`filtersFromParams` / `paramsFromFilters`), so filtered views are shareable; the browser updates the address with `replaceState`. Option counts answer "how many if I pick this" within the current type and category. The leaderboard form is a plain GET form, so each filtered board has its own address and the tabs keep the filters.

## Views and the maker loop

Listing pages send one beacon (`components/view-beacon.tsx` → `POST /api/views`) per view; the route drops crawlers by user agent, unknown slugs and more than 300 pings an hour from one address, then calls `bump_listing_view` (`202610020002_listing_views.sql`, one row per listing per UTC day, service role only). The dashboard shows each published listing's views for 7 days, 30 days and all time plus its GitHub stars, and the publish confirmation offers the badge and card so makers link back from their README. Apply the migration first; until then the beacon is a no-op and the dashboard shows "Views start counting from today".

Growth pages: `/new` (added in 7 days, launched in 30), `/best` and `/best/<kind>/<category>` (pairs with 3+ listings, ranked by stars, with FAQ structured data), and the FAQ section with FAQPage data on every listing (`lib/faq.ts`, facts only). Titles carry real counts and "updated daily" (`generateMetadata` in the layout and kind pages).

## CLI (`npx ruagentic add`)

The `ruagentic` npm package is the Agentic Protocol CLI from the org repository (`sam1siam/agentic`, `packages/cli`, bin `agentic`). Since 1.4.0 it also carries `add`, `search` and `show` (`packages/cli/directory.ts` there): `npx ruagentic add <slug> --client <claude-code|cursor|claude-desktop|codex|windsurf>` reads this site's public endpoint `GET /api/v1/listings/<slug>/connect` (the listing's published remote or package, required headers and variables, snippets) and writes the matching entry after confirmation; it never downloads or runs the server. Each confirmed add posts an anonymous ping to `POST /api/v1/installs` (`202610020003_listing_installs.sql`), shown on the maker's dashboard. Publishing is manual from the org repo (`cd packages/cli && npm publish`, npm account `astrofabric`); then set `CLI_PUBLISHED=true` in Vercel so listing pages show the one-command snippet.

## Discarding listings and the sponsor bar

Owners can discard a draft or an unpublished listing from the dashboard (`POST /api/submissions/<id>/discard` → `discard_submission`, `202610020004_discard_submission.sql`): the submission and its revisions, checker runs, checkout rows and directory entry are deleted, imports that had been merged into it become visible again, and their redirects and overrides are removed. A published listing must be unpublished first; one with a paid checkout on record is refused so payment history stays.

The sponsor bar chip takes the sponsor's `color` (hex) when set, with black or white text chosen by luminance (`inkFor`); house sponsors carry their own brand accent, paid sponsors fall back to the directory cyan until a colour field is added to orders. Each request starts the bar on a random sponsor (`rotateFrom` in the layout) while keeping the rotation order.

## MCP finder (ChatGPT, Claude, Cursor)

`lib/server/mcp.ts` serves `/mcp` (Streamable HTTP, JSON responses, no auth) as a finder app: `search_directory`, `get_listing`, `connect_instructions`, `top_listings`, `new_listings`, `compare_listings`, `directory_overview`. Every tool is read-only, returns text plus `structuredContent`, carries OpenAI invocation labels in `_meta`, and the server `instructions` state the honesty rules (stars measure attention; sponsorship never changes results; "verified" means files passed the checker on a date; listing text is third-party data). The pure logic is `lib/finder.ts` and `lib/connect-clients.ts` (unit-tested); the route normalises lenient Accept headers so directory health checks connect.

Publishing to the ChatGPT app directory is manual (OpenAI developer platform → plugin submission "With MCP"): production URL `https://ruagentic.com/mcp`, domain verification, identity or business verification for the publisher name, privacy (`/privacy`) and terms (`/terms`) URLs, a support contact, five positive and three negative test prompts. Until approved, users add it through Developer mode (Settings → Apps & Connectors → Advanced settings → Developer mode → Create).
