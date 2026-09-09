# Directory deployment and operations

## Separate resources

Use the `ruagentic-directory` Vercel project and `sam1siam/ruagentic-directory` repository. The convention in `../org` keeps its existing deployment, database, and npm package. This directory does not charge for ruagentic.org.

## Supabase

Create the directory database in the RUAGENTIC organization. Apply the SQL migration and run the seed script. Configure public URL `https://ruagentic.com`, confirmed email registration, secure email changes, and callbacks `/auth/callback`, `/auth/confirm`, and `/reset-password`. Do not permit arbitrary redirect hosts.

Configure custom SMTP with the verified Resend sending domain before opening registration. The default Supabase email service is not a public production email setup. Enable appropriate auth rate limits and monitor delivery. Keep database/service keys server-only; use the publishable key in browser code. RLS remains enabled on all exposed tables.

Set the minimum password length to 12 characters, matching the signup and reset forms. Use `smtp.resend.com`, port `465`, username `resend`, sender `notifications@mail.ruagentic.com`, and sender name `RUAGENTIC`. Store a separate Resend key named `RUAGENTIC auth SMTP`, restricted to sending from `mail.ruagentic.com`, as the SMTP password. Keep that key in Supabase only. The app's listing-email key stays in Vercel. Custom SMTP initially allows 30 auth emails per hour; review capacity and delivery before raising that limit.

Use these Supabase email templates with Site URL `https://ruagentic.com`. They use the existing token-hash confirmation route so opening an email on another device does not require the original browser's PKCE verifier. Keep email link tracking disabled. Test actual email receipt, confirmation, and recovery after configuring the domain.

GitHub uses the separate **RUAGENTIC Directory** OAuth application owned by `sam1siam`, configured only in this directory's Supabase GitHub provider. Homepage: `https://ruagentic.com`. GitHub callback: `https://efvjfubdvfrzexawpoqb.supabase.co/auth/v1/callback`. Keep wildcard callbacks, device flow, and email-optional authentication disabled. The app requests no additional GitHub scopes. GitHub login identifies an account; it does not verify repository ownership.

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

Cards and tiles open the sponsor's page at `/sponsors/<slug>` (noindex), which carries the outbound link; the house sponsor's card opens its directory listing instead. Paid sponsors take a slot ahead of the house sponsor and rotate every ten minutes within a placement. Slots no paid sponsor covers show the house sponsor defined in `lib/advertising.ts` (AstroFabric, whose description is taken from its own product wording).

Sponsorship never affects ordering, source labels or Agentic Protocol checks, and every placement is labelled as sponsored.

## Sponsor self-service

Buying a placement requires a signed-in, confirmed account; the order stores the buyer (`ad_orders.owner_id`, migration 202609080005) and orders paid earlier are claimed by the confirmed email that paid. The dashboard shows every sponsorship with its state, monthly amount and renewal date (read live from Stripe), and offers: Manage billing (a Stripe Customer Portal session: card, invoices, cancel; the portal must be enabled in Stripe with cancellation allowed), Edit creative (tagline, description, button label, categories) and Buy another placement. Edits to a live creative are stored in `pending` and the live version stays up until a reviewer approves them from the Sponsorships tab; edits to an order still in review replace it in place. Category changes are charged or credited the moment the sponsor saves them (the subscription's extra-category line, `STRIPE_AD_PRICE_CATEGORY`, is created, updated or removed with proration); the wording still waits for review, and rejecting pending changes reverts the line to the live categories. Orders without a Stripe customer (demo orders) show no billing button.

Lifecycle: an unpublished (withdrawn) listing answers 404 with a page saying it is unavailable, never a redirect, because the owner can republish under the same slug; a deleted listing is removed with its page, bookmarks and payment attempts (Stripe keeps the payment record) while reports survive, and a later re-listing gets a new slug. A cancelled sponsorship stays live until the paid period ends, then the webhook marks it cancelled: the bar, card and tile slots go to the next paid sponsor or the house sponsor and the sponsor page answers 404; sponsored cards are slots, not listings, so nothing "becomes unsponsored" and any directory listing the sponsor has is untouched. The restricted Stripe key needs Checkout Sessions (write), Billing Portal sessions (write), Customers (read) and Subscriptions (write).

## Admin

`/admin` is the review console: it requires a confirmed Supabase sign-in whose email is listed in `ADMIN_EMAILS` (default `hello@ruagentic.com`); anyone else gets a 404. Tabs: Overview (accounts created, free and paid listings, submissions and sponsorship orders for today, 7 and 30 days and all time, a daily chart, and the admin action log), Sponsorships (every order with all fields; approve, reject with a note that is emailed, or return to the queue), Submissions (by day range and route, with suspend/restore), Accounts (creations with confirmation state and listing counts), Reports (open and closed listing reports) and Email (the confirmation outbox with retry).

Sponsorships render only when `approval = 'approved'` and the subscription is active; sponsors are told to expect a decision within 24–48 hours. Every admin action is written to `admin_actions`. Apply `supabase/migrations/202609080004_admin.sql`.

To create or reset the admin account without putting a password in the repository, call the bootstrap endpoint with the cron secret (the address must be in `ADMIN_EMAILS`):

```
curl -X POST https://ruagentic.com/api/admin/bootstrap \
  -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"email":"hello@ruagentic.com","password":"<at least 12 characters>"}'
```

Signing up through `/login` with that address works too; the account only needs to be confirmed.

## Catalog

`data/catalog.json` bundles source-labelled listings. The public catalog merges database rows with bundled entries the database has not stored yet, and the hourly `/api/cron/seed` cron inserts those rows (never touching existing ones) so bookmarks and reports can reference them.

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
