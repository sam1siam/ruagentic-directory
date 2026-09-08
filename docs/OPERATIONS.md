# Directory deployment and operations

## Separate resources

Use the `ruagentic-directory` Vercel project and `sam1siam/ruagentic-directory` repository. The convention in `../org` keeps its existing deployment, database, and npm package. This directory does not charge for ruagentic.org.

## Supabase

Create the directory database in the RUAGENTIC organization. Apply the SQL migration and run the seed script. Configure public URL `https://ruagentic.com`, confirmed email registration, secure email changes, and callbacks `/auth/callback`, `/auth/confirm`, and `/reset-password`. Do not permit arbitrary redirect hosts.

Configure custom SMTP with the verified Resend sending domain before opening registration. The default Supabase email service is not a public production email setup. Enable appropriate auth rate limits and monitor delivery. Keep database/service keys server-only; use the publishable key in browser code. RLS remains enabled on all exposed tables.

## Stripe

Create one product, RUAGENTIC directory listing, and a **non-recurring US$49.99** price. Put its exact price ID in `STRIPE_PRICE_ID`. Configure the public business name, support email, website, terms URL, and receipt delivery before enabling live charges.

Register `https://ruagentic.com/api/webhooks/stripe` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`

Use the endpoint’s matching live signing secret. Test mode keys and signatures must remain separate. The browser never establishes payment status. Fulfillment validates the retrieved session, line item, price, amount, currency, mode, revision, and internal attempt ID, then commits publication and email together.

Interrupted creation reuses the persisted attempt’s Stripe idempotency key and stable request parameters. If the key’s safe retry window has passed without a stored provider session, reconcile that attempt with Stripe before authorizing another charge. Never mark an ambiguous payment failed solely because the browser lost its response.

A refunded or disputed payment is durably recorded even if its webhook precedes the success event. Affected paid listings are hidden. Resolve legitimate disputes and restore listings through a reviewed database operation; a dispute outcome does not automatically restore a removed page.

## Resend

Verify `mail.ruagentic.com`. `RESEND_FROM` identifies the sender; `SUPPORT_EMAIL` must be a monitored inbox. Use a sending-only domain-scoped API key. Confirmation messages are queued in the publication transaction and attempted after the response. The daily cron retries outstanding jobs; manually invoke the protected cron after fixing a provider outage if quicker recovery is needed.

The email outbox stores the exact provider request and stable idempotency key. Workers use expiring leases and fencing tokens. Attempts stop before the provider’s 24-hour deduplication window expires. Rows marked `uncertain` require provider reconciliation; do not reset them blindly to pending. Publication remains live if email is delayed.

## DNS and release

Keep Spaceship nameservers unless deliberately migrating the full zone. Add only the exact Vercel apex/www records and Resend DNS records returned for this directory. Preserve unrelated domain and mail records. Redirect `www.ruagentic.com` to the canonical apex before testing cookies and forms.

Set every variable in `.env.example` for production. `node scripts/check-environment.ts` checks presence and basic production identity without printing secrets. After deployment, verify provider health, confirmed signup/reset, free publication, Stripe test transactions/webhooks, email receipt, public URL, and RLS isolation. Production charging requires a live, activated Stripe account.

## Moderation and account requests

Review `listing_reports` through the private Supabase dashboard. For corrections, retain source evidence. Suspend by hiding the public entry and setting its submission state to `suspended` in one transaction. Do not treat a payment or file audit as ownership proof. Handle ownership transfers only after independent account-bound evidence; the public submission flow does not grant imported-entry ownership.

Account deletion requests require checking retention obligations and removing the Auth user through privileged account administration. Do not collect sensitive account information through public issues.

## Validation scope

Local SQL/RLS/concurrency tests can run in an isolated, labeled PostgreSQL container. They do not prove Supabase Auth email delivery, live Stripe activation, Resend delivery, DNS, or browser behavior. WebMCP has a feature-detected browser integration; record a real supported-context check before claiming browser tool verification.
