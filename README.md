# RUAGENTIC Directory

RUAGENTIC is the official Agentic directory for agentic AI MCP servers, clients, and tools. It is an independent directory, separate from the official Model Context Protocol registry.

The directory lives at **https://ruagentic.com**. The free file convention, generator, auditor, and CLI live at **https://ruagentic.org**, in the separate [sam1siam/agentic](https://github.com/sam1siam/agentic) repository.

## Features

- Responsive discovery, categories, collections, detailed project pages, side-by-side comparisons, and a keyboard-accessible Ctrl/Cmd+K search palette.
- GitHub sign-in, passwordless email links, password accounts and recovery, saved tools, and a listing dashboard.
- Four-step submission with URL autofill from public websites, repositories, documentation, OpenAPI, Agentic profiles, and READMEs. Suggestions show their sources and preserve manual edits.
- A one-time US$49.99 Stripe listing or free publication after server-verified Agentic JSON, TXT, and README checks.
- Revision-bound publication, immutable snapshots, durable payment fulfillment, refund handling, and a transactional confirmation-email outbox.
- Public discovery API, read-only MCP server, and browser directory filtering where WebMCP is supported.
- Source-labeled registry and editorial entries. Imports do not imply ownership, submission, or Agentic adoption.

## Run locally

Use Node 24. Copy `.env.example` to `.env.local` and configure a **separate directory** Supabase project and provider test credentials. For local forms, set `APP_URL=http://localhost:3207` and allow that callback origin in the test Supabase project.

```sh
npm ci
npm run dev
```

Without account variables, public catalog pages use the checked-in source dataset and account forms report that setup is incomplete. Production must have all providers configured before accepting submissions.

## Database

Apply the files in `supabase/migrations/` to the directory project in order. The first creates tables, RLS policies, immutable revisions, and transactional publication/payment functions; later files replace functions or constraints and are safe to apply on top. Browser roles cannot publish or change payment/verification state.

Import the source-labeled catalog once:

```sh
node --env-file=.env.local scripts/seed.ts
```

The seed preserves existing rows. `data/catalog.json` retains source URLs and collection dates; registry metadata licensing does not grant rights to third-party software or trademarks.

## Deploy

See [deployment and operations](docs/OPERATIONS.md). Vercel project: `ruagentic-directory`. GitHub repository: `sam1siam/ruagentic-directory`. Never deploy this checkout into the convention’s `ruagentic` Vercel project.

```sh
npm test
npm run typecheck
npm run build
```

## Interfaces

- `GET /api/v1/listings` — public search with `q`, `kind`, `category`, `limit`, and `offset`.
- `GET /api/v1/listings/{slug}` — public listing details.
- `/mcp` — Streamable HTTP MCP with `search_directory` and `get_listing`; read-only, no key required.
- `/agentic.json`, `/agentic.txt`, `/llms.txt`, `/openapi.json` — published machine-readable documentation.

## Agentic publication

- [Agentic JSON profile](https://ruagentic.com/agentic.json)
- [Agentic TXT index](https://ruagentic.com/agentic.txt)
- [Agentic convention and free tools](https://ruagentic.org)
- [RUAGENTIC directory](https://ruagentic.com)

[Agentic](https://ruagentic.org) is the open file convention for describing websites, APIs, and agent connections, with specifications and tools for generation, validation, auditing, and action-result verification. [RUAGENTIC](https://ruagentic.com) is the official Agentic directory for agentic AI MCP servers and tools.

## Security and corrections

Do not submit private tokens or credential-bearing URLs. Listing content is untrusted project information; a file check is not a security or ownership certification. Use the Report option on a listing for corrections. For private account or payment information, use the support contact published on the site rather than a public GitHub issue.
