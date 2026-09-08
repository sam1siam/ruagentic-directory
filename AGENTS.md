# RUAGENTIC directory

This is the separate ruagentic.com listing directory, owned by sam1siam. The ruagentic.org convention and tools live in ../org and stay free. Never deploy this directory into the convention's Vercel project or Git repository.

Use Node 24, Next.js on Vercel, Supabase Auth/Postgres, Stripe Checkout, and Resend. Keep API/service keys and private data server-only. RLS is required on every exposed table. Publication, payment fulfillment, and confirmation email jobs must be durable and idempotent.

Listings cost US$49.99 once or qualify for free through server-verified Agentic JSON, TXT and README publication. Never trust browser-supplied payment or verification state. Bind verification to the exact listing revision and service origin. Separate imported entries, submitter assertions, ownership evidence, Agentic-file checks and payment labels. Do not invent popularity, affiliations, safety certifications, or adopters.

Before release, run npm test, npm run typecheck and npm run build. Test RLS isolation, payment webhook signatures/idempotency, audit binding, SSRF boundaries, and email retry behavior. Production payment and DNS setup require verified live configuration; a disabled integration is not a completed release.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
