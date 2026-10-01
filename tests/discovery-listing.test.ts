import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTOFF, type Candidate } from '../lib/discovery/policy.ts';
import {
  listingFromCandidate,
  listingKind,
  slugify,
  suggestCategory,
  uniqueSlug,
} from '../lib/discovery/listing.ts';
import { listingSchema } from '../lib/listing.ts';
import { prepareCatalog } from '../lib/catalog-import.ts';
import { runDiscovery } from '../lib/discovery/run.ts';
import type { CandidateRow, DiscoveryStore } from '../lib/discovery/store.ts';

const now = '2026-10-01T11:17:00.000Z';
const candidate: Candidate = {
  source: 'github',
  id: 'acme/tool',
  name: 'Acme Tool',
  description:
    'An MCP server for the Acme billing API. It exposes invoices and customers as tools.',
  sourceUrl: 'https://github.com/acme/tool',
  repository: 'https://github.com/acme/tool',
  homepage: 'https://acme.dev/?utm_source=github#top',
  kind: 'mcp-server',
  publishedAt: '2026-09-20T10:00:00Z',
  dateEvidence: 'GitHub repository creation time',
};

void test('Listing kind comes from the source or the project’s own words, never a guess', () => {
  assert.equal(listingKind(candidate), 'server');
  assert.equal(listingKind({ ...candidate, kind: 'mcp-client' }), 'client');
  assert.equal(listingKind({ ...candidate, kind: 'ai-agent' }), 'product');
  assert.equal(
    listingKind({
      ...candidate,
      kind: undefined,
      description: 'A desktop MCP client for local models.',
    }),
    'client',
  );
  assert.equal(
    listingKind({
      ...candidate,
      kind: undefined,
      description: 'Show HN: an autonomous agent that triages support tickets',
    }),
    'product',
  );
  assert.equal(
    listingKind({ ...candidate, kind: undefined, description: 'A photo app' }),
    undefined,
  );
});
void test('Category suggestions and slugs are deterministic', () => {
  assert.equal(
    suggestCategory('Postgres database queries'),
    'Data & intelligence',
  );
  assert.equal(
    suggestCategory('Playwright browser control'),
    'Browser & web automation',
  );
  assert.equal(suggestCategory('Something entirely different'), 'Other');
  assert.equal(slugify('  Acme  Tool! v2 '), 'acme-tool-v2');
  assert.equal(slugify('Ünïcode Näme'), 'unicode-name');
  assert.equal(uniqueSlug(candidate, new Set()), 'acme-tool');
  const taken = uniqueSlug(candidate, new Set(['acme-tool']));
  assert.match(taken, /^acme-tool-[0-9a-f]{6}$/);
  assert.match(
    uniqueSlug({ ...candidate, name: '日本語' }, new Set()),
    /^github-[0-9a-f]{8}$/,
  );
});
void test('A candidate becomes a valid imported listing with its provenance', () => {
  const row = listingFromCandidate(candidate, now, new Set());
  assert.equal(row.slug, 'acme-tool');
  assert.equal(row.visible, true);
  const data = row.data;
  assert.equal(data.kind, 'server');
  assert.equal(data.name, 'Acme Tool');
  assert.equal(data.summary, 'An MCP server for the Acme billing API.');
  assert.match(data.description, /^An MCP server for the Acme billing API\./);
  assert.match(data.description, /Found on GitHub on 2026-09-20\./);
  assert.match(data.description, /not been reviewed by the project's owner/);
  assert.equal(data.homepage, 'https://acme.dev/');
  assert.equal(data.repository, 'https://github.com/acme/tool');
  assert.equal(data.category, 'Finance');
  assert.deepEqual(data.tags, ['mcp']);
  assert.equal(data.pricing, 'unknown');
  assert.equal(data.transport, 'unknown');
  assert.equal(data.license, '');
  assert.equal(data.source, 'GitHub');
  assert.equal(data.sourceUrl, 'https://github.com/acme/tool');
  assert.equal(data.observedAt, now);
  assert.equal(data.publishedAt, '2026-09-20T10:00:00Z');
  assert.equal(data.imported, true);
  assert.equal(data.submitted, false);
  assert.equal(data.ownershipVerified, false);
  assert.deepEqual(
    (data.sources as { kind: string }[]).map((s) => s.kind),
    ['automated-discovery', 'editorial-normalization'],
  );
  // The same row passes the bundled-catalog import path and the listing schema.
  assert.equal(prepareCatalog([{ ...data }], now).length, 1);
  const {
    slug: _s,
    source: _so,
    sourceUrl: _su,
    observedAt: _o,
    publishedAt: _p,
    imported: _i,
    submitted: _sb,
    ownershipVerified: _ov,
    sources: _sr,
    ...input
  } = data;
  assert.equal(listingSchema.parse(input).kind, 'server');
  // A short description still yields a usable summary and description.
  const short = listingFromCandidate(
    { ...candidate, description: 'Tiny' },
    now,
    new Set(),
  );
  assert.equal(
    short.data.summary,
    'Acme Tool is an MCP server first seen on GitHub.',
  );
  assert.ok(short.data.description.length >= 60);
  // Nothing is published when the kind cannot be told.
  assert.throws(
    () =>
      listingFromCandidate(
        { ...candidate, kind: undefined, description: 'A photo app' },
        now,
        new Set(),
      ),
    /Could not tell/,
  );
});
void test('The run publishes qualified candidates and skips projects without a website', async () => {
  const previous = process.env.DISCOVERY_LISTING_ENABLED;
  delete process.env.DISCOVERY_LISTING_ENABLED;
  const rows: CandidateRow[] = [
    {
      id: 'with-site',
      source: 'github',
      status: 'pending',
      reason: null,
      contact: null,
      attempts: 0,
      data: candidate,
    },
    {
      id: 'repo-only',
      source: 'github',
      status: 'pending',
      reason: null,
      contact: null,
      attempts: 0,
      data: {
        ...candidate,
        id: 'hobby/server',
        name: 'Hobby Server',
        homepage: undefined,
        repository: 'https://github.com/hobby/server',
        sourceUrl: 'https://github.com/hobby/server',
      },
    },
  ];
  const published: { slug: string; visible: boolean }[] = [];
  const updates: { id: string; values: Record<string, unknown> }[] = [];
  let finished:
    | { candidates: Record<string, number>; mode?: string }
    | undefined;
  const table = {
    select: () => table,
    order: () => table,
    range: async () => ({ data: [], error: null }),
  };
  const store = {
    db: { from: () => table },
    claim: async () => 'owner',
    source: async (source: string) => ({
      source,
      initialized_at: CUTOFF,
      last_success_at: CUTOFF,
      seen_keys: [],
    }),
    sourceError: async () => {},
    commit: async () => ({ observed: 0, newCandidates: 0, baseline: false }),
    listingSlugs: async () => ['acme-tool'],
    budget: async () => true,
    pending: async () => rows,
    publishListing: async (row: { slug: string; visible: boolean }) => {
      published.push({ slug: row.slug, visible: row.visible });
      return true;
    },
    update: async (id: string, values: Record<string, unknown>) => {
      updates.push({ id, values });
    },
    finish: async (_day: string, _owner: string, report: typeof finished) => {
      finished = report;
    },
  } as unknown as DiscoveryStore;
  try {
    const report = await runDiscovery({
      store,
      now: new Date(now),
      snapshot: async (source) => ({ source, items: [], complete: true }),
    });
    assert.ok('candidates' in report);
    assert.equal(report.mode, 'discovery_and_listing');
    assert.equal(report.candidates.listed, 1);
    assert.equal(report.candidates.skipped, 1);
    assert.equal(report.candidates.failed, 0);
    assert.equal(published.length, 1);
    assert.equal(published[0]!.visible, true);
    assert.match(published[0]!.slug, /^acme-tool-[0-9a-f]{6}$/);
    const listed = updates.find((u) => u.id === 'with-site');
    assert.equal(listed?.values.status, 'listed');
    assert.equal(
      listed?.values.reason,
      `Listed as /tools/${published[0]!.slug}`,
    );
    const skipped = updates.find((u) => u.id === 'repo-only');
    assert.equal(skipped?.values.status, 'skipped');
    assert.equal(
      skipped?.values.reason,
      'No independently identifiable project website',
    );
    assert.equal(finished?.candidates.listed, 1);
  } finally {
    if (previous === undefined) delete process.env.DISCOVERY_LISTING_ENABLED;
    else process.env.DISCOVERY_LISTING_ENABLED = previous;
  }
});
void test('Listing can be paused without stopping source collection', async () => {
  const previous = process.env.DISCOVERY_LISTING_ENABLED;
  process.env.DISCOVERY_LISTING_ENABLED = 'false';
  let pendingCalls = 0;
  const store = {
    claim: async () => 'owner',
    source: async (source: string) => ({
      source,
      initialized_at: CUTOFF,
      last_success_at: CUTOFF,
      seen_keys: [],
    }),
    commit: async () => ({ observed: 0, newCandidates: 0, baseline: false }),
    pending: async () => {
      pendingCalls++;
      return [];
    },
    finish: async () => {},
  } as unknown as DiscoveryStore;
  try {
    const report = await runDiscovery({
      store,
      now: new Date(now),
      snapshot: async (source) => ({ source, items: [], complete: true }),
    });
    assert.ok('candidates' in report);
    assert.equal(report.mode, 'discovery_only');
    assert.equal(pendingCalls, 0);
  } finally {
    if (previous === undefined) delete process.env.DISCOVERY_LISTING_ENABLED;
    else process.env.DISCOVERY_LISTING_ENABLED = previous;
  }
});
