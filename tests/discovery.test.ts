import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aliases,
  companyDomain,
  CUTOFF,
  dayKey,
  digest,
  isNew,
  publicUrl,
  qualify,
  repositoryKey,
  validEmail,
  type Candidate,
} from '../lib/discovery/policy.ts';
import {
  parseCline,
  parseDocker,
  parseProductHunt,
  parseSitemap,
  parseDetail,
  parseMicrosoft,
  parseLiteLLM,
} from '../lib/discovery/sources.ts';
import {
  belongsToCompany,
  founderRecord,
  publicContacts,
  verifiedFounder,
} from '../lib/discovery/contacts.ts';
import { leadPayload, Smartlead } from '../lib/discovery/smartlead.ts';
import { DiscoveryStore, type Contact } from '../lib/discovery/store.ts';
import { ProviderError, apiJson } from '../lib/discovery/http.ts';
import { mcpSoMetadata } from '../lib/discovery/mcp-so.ts';

void test('MCP.so reshuffled and renamed old entries use their exact original creation date', () => {
  const html = `<h1>ExampleVerifiedFeatured</h1><script>const page={server:$R[16]={slug:'new-slug',previousSlug:'old-slug',name:'Example',description:'createdAt: a misleading string',createdAt:$R[17]=new Date('2025-07-21T09:03:18.907Z'),updatedAt:new Date('2026-09-10T10:00:00Z')},related:[{slug:'other',createdAt:new Date('2026-09-10T10:00:00Z')}]};</script>`;
  const parsed = parseDetail(
    { ...item, source: 'mcp-so', sourceUrl: 'https://mcp.so/servers/new-slug' },
    html,
  );
  assert.equal(parsed.name, 'Example');
  assert.equal(parsed.publishedAt, '2025-07-21T09:03:18.907Z');
  assert.equal(isNew(parsed, new Set(), true, '2026-09-10T15:00:00Z'), false);
  assert.equal(mcpSoMetadata(html, 'unrelated'), undefined);
  assert.equal(
    mcpSoMetadata(html, 'old-slug')?.publishedAt,
    parsed.publishedAt,
  );
});

void test('MCP.so dates are read without running JavaScript and ambiguous dates are held', () => {
  const script = `<script>throw new Error('must never execute'); const page={server:{slug:'new',name:'New',createdAt:new Date('${CUTOFF}')}};</script>`;
  assert.equal(mcpSoMetadata(script, 'new')?.publishedAt, CUTOFF);
  assert.equal(
    mcpSoMetadata(
      `<script>const page={server:{slug:'new',createdAt:guessDate()}};</script>`,
      'new',
    ),
    undefined,
  );
  assert.equal(
    mcpSoMetadata(
      script +
        `<script>const other={server:{slug:'new',createdAt:new Date('2025-01-01')}};</script>`,
      'new',
    ),
    undefined,
  );
  const unknown = parseDetail(
    { ...item, source: 'mcp-so', sourceUrl: 'https://mcp.so/servers/new' },
    '<h1>New</h1>',
  );
  assert.equal(unknown.dateEvidence, undefined);
});

const item: Candidate = {
  source: 'cline',
  id: 'new-server',
  name: 'New Server',
  description: 'An MCP server for business workflows',
  kind: 'mcp-server',
  sourceUrl: 'https://github.com/cline/marketplace',
  homepage: 'https://example.com',
  repository: 'https://github.com/example/new-server',
};
const contact: Contact = {
  email: 'founder@example.com',
  firstName: 'Pat',
  fullName: 'Pat Example',
  companyDomain: 'example.com',
  provider: 'fixture',
  evidence: 'fixture',
  verifiedAt: CUTOFF,
};
void test('Toronto cutoff excludes previous evening, old updates and future publications', () => {
  const now = '2026-09-10T15:00:00Z';
  for (const publishedAt of [
    '2026-09-10T03:59:59Z',
    '2026-01-01T12:00:00Z',
    'bad',
    '2026-09-11T00:00:00Z',
  ])
    assert.equal(
      isNew(
        { ...item, publishedAt, dateEvidence: 'first publication' },
        new Set(),
        true,
        now,
      ),
      false,
    );
  assert.equal(
    isNew(
      { ...item, publishedAt: CUTOFF, dateEvidence: 'first publication' },
      new Set(),
      false,
      now,
    ),
    true,
  );
  assert.equal(dayKey(new Date('2026-09-10T03:59:59Z')), '2026-09-09');
});
void test('Undated sources require a baseline and IDs never reappear as new', () => {
  assert.equal(isNew(item, new Set(), false, CUTOFF), false);
  assert.equal(isNew(item, new Set(), true, CUTOFF), true);
  assert.equal(isNew(item, new Set([digest(item.id)]), true, CUTOFF), false);
  for (const source of ['official-registry', 'docker', 'producthunt'] as const)
    assert.equal(isNew({ ...item, source }, new Set(), true, CUTOFF), false);
});
void test('Publication evidence is mandatory, sitemap lastmod and PH updated are ignored', () => {
  assert.equal(
    isNew({ ...item, publishedAt: CUTOFF }, new Set(), true, CUTOFF),
    false,
  );
  const map = parseSitemap(
    '<urlset><url><loc>https://mcp.so/servers/old</loc><lastmod>2026-09-10</lastmod></url></urlset>',
    'mcp-so',
  );
  assert.equal(map.items[0].publishedAt, undefined);
  const [ph] = parseProductHunt(
    '<feed><entry><id>old</id><title>AI Agent</title><published>2026-09-09T10:00:00Z</published><updated>2026-09-10T10:00:00Z</updated><link rel="alternate" href="https://www.producthunt.com/products/old"/><content>&lt;p&gt;An AI agent&lt;/p&gt;</content></entry></feed>',
  );
  assert.equal(isNew(ph, new Set(), true, '2026-09-10T15:00:00Z'), false);
  const detailed = parseDetail(
    item,
    '<h1>Old server</h1><script type="application/ld+json">{"@type":"SoftwareApplication","datePublished":"2026-08-01","dateModified":"2026-09-10"}</script>',
  );
  assert.equal(isNew(detailed, new Set(), true, '2026-09-10T15:00:00Z'), false);
});
void test('Catalog adapters include only listed product types and preserve original dates', () => {
  assert.equal(
    parseCline({
      entries: [
        { id: 'a', type: 'mcp', name: 'A', repo: 'https://github.com/a/b' },
        { id: 'b', type: 'skill', name: 'B' },
      ],
    }).length,
    1,
  );
  assert.equal(
    parseDocker({
      registry: {
        a: {
          title: 'A',
          dateAdded: '2025-01-01',
          upstream: 'https://github.com/a/b',
        },
      },
    })[0].publishedAt,
    '2025-01-01',
  );
  assert.equal(
    parseLiteLLM({
      servers: [{ name: 'a', url: 'https://example.com/mcp' }],
    })[0].endpoint,
    'https://example.com/mcp',
  );
  assert.equal(
    parseMicrosoft(
      '### Microsoft Server\n- **REPOSITORY**: [server](https://github.com/microsoft/server)\n- **DESCRIPTION**: An MCP server.',
    )[0].repository,
    'https://github.com/microsoft/server',
  );
  assert.throws(() => parseCline({ entries: null }));
  assert.throws(() => parseMicrosoft('removed'));
});
void test('Public company identities handle suffixes and exclude shared hosting', () => {
  assert.equal(
    companyDomain('https://docs.example.co.uk/path'),
    'example.co.uk',
  );
  assert.equal(companyDomain('https://example.github.io'), undefined);
  assert.equal(companyDomain('https://github.com/a/b'), undefined);
  assert.equal(
    repositoryKey('https://github.com/Owner/Repo.git/tree/main'),
    'github.com/owner/repo',
  );
  assert(aliases(item).includes('domain:example.com'));
  assert.equal(publicUrl('https://example.com?api_key=secret'), undefined);
  assert.equal(publicUrl('https://name:pass@example.com'), undefined);
  assert.equal(
    publicUrl('https://www.example.com/'),
    'https://www.example.com',
  );
});
void test('Product qualification excludes content and unsupported products', () => {
  assert.equal(qualify(item).eligible, true);
  assert.equal(
    qualify({
      ...item,
      kind: undefined,
      name: 'AI newsletter',
      description: 'AI agent news',
    }).eligible,
    false,
  );
  assert.equal(
    qualify({ ...item, kind: undefined, description: 'A photo editor' })
      .eligible,
    false,
  );
  assert.equal(validEmail('noreply@example.com'), false);
  assert.equal(validEmail('x@example.com\r\nBcc: x@evil.com'), false);
});
void test('Enrichment rejects mismatched companies, former founders and unverified email', () => {
  const r = {
    company: { domain: 'example.com' },
    person: {
      person_id: 'p1',
      current_job_title: 'Co-founder',
      first_name: 'Pat',
      full_name: 'Pat Example',
      email: { status: 'VERIFIED', revealed: true, email: 'pat@example.com' },
    },
  };
  assert.equal(belongsToCompany(r, 'other.com'), false);
  assert.equal(
    verifiedFounder(r, 'example.com', 'record')?.email,
    'pat@example.com',
  );
  assert.equal(
    verifiedFounder(
      { ...r, company: { domain: 'other.com' } },
      'example.com',
      'record',
    ),
    null,
  );
  assert.equal(
    founderRecord(
      { ...r, person: { ...r.person, current_job_title: 'Engineer' } },
      'example.com',
    ),
    false,
  );
  for (const title of ['Former founder', 'Product owner', 'Project owner']) {
    assert.equal(
      founderRecord(
        { ...r, person: { ...r.person, current_job_title: title } },
        'example.com',
      ),
      false,
    );
  }
  assert.equal(
    verifiedFounder(
      {
        ...r,
        person: {
          ...r.person,
          email: { ...r.person.email, status: 'UNAVAILABLE' },
        },
      },
      'example.com',
      'record',
    ),
    null,
  );
});
void test('Public email fallback takes published contacts, excluding explicit no-marketing notices', () => {
  const r = publicContacts(
    '<p><a href="mailto:hello@example.com">Contact</a></p><p>No unsolicited marketing <a href="mailto:owner@example.com">Email</a></p><p><a href="mailto:privacy@example.com">Privacy</a></p>',
    'https://example.com/contact',
  );
  assert.deepEqual(
    r.map((x) => x.email),
    ['hello@example.com'],
  );
});
void test('Lead imports preserve suppression and render untrusted names as data', () => {
  const p = leadPayload({ ...item, name: '<b>{{bad}}</b>\nName' }, contact);
  assert.equal(p.settings.ignore_global_block_list, false);
  assert.equal(p.settings.ignore_unsubscribe_list, false);
  assert.equal(p.settings.ignore_duplicate_leads_in_other_campaign, false);
  assert(!/[<>{}\n]/.test(p.lead_list[0].custom_fields.project_name));
  assert.equal(
    leadPayload(item, { ...contact, firstName: '' }).lead_list[0].custom_fields
      .greeting_name,
    'there',
  );
});
void test('Unknown Smartlead acknowledgements remain uncertain; errors are not retried', async () => {
  let calls = 0;
  const s = new Smartlead('test-key', Date.now() + 5000, async () => {
    calls++;
    return { ok: true };
  });
  assert.equal((await s.import(item, contact)).status, 'uncertain');
  assert.equal(calls, 1);
  const failing = new Smartlead('test-key', Date.now() + 5000, async () => {
    throw new ProviderError('server.smartlead.ai', 429);
  });
  await assert.rejects(failing.exists('x@example.com'), /429/);
});
void test('Incomplete snapshots cannot advance the database checkpoint', async () => {
  let writes = 0;
  const db = {
    rpc: async () => {
      writes++;
      return { error: null };
    },
  } as unknown as ConstructorParameters<typeof DiscoveryStore>[0];
  const s = new DiscoveryStore(db),
    state = {
      source: 'cline' as const,
      initialized_at: null,
      last_success_at: null,
      seen_keys: [],
    };
  await assert.rejects(
    s.commit(
      { source: 'cline', complete: false, items: [item] },
      state,
      CUTOFF,
    ),
    /Incomplete/,
  );
  assert.equal(writes, 0);
});
void test('Complete first snapshot creates no undated candidate; subsequent snapshots preserve old IDs', async () => {
  type Commit = { p_candidates: unknown[]; p_seen: string[] };
  const calls: Commit[] = [];
  const s = new DiscoveryStore({
    rpc: async (_name: string, data: unknown) => {
      calls.push(data as Commit);
      return { error: null };
    },
  } as unknown as ConstructorParameters<typeof DiscoveryStore>[0]);
  const state = {
    source: 'cline' as const,
    initialized_at: null,
    last_success_at: null,
    seen_keys: [],
  };
  await s.commit(
    { source: 'cline', complete: true, items: [item] },
    state,
    CUTOFF,
  );
  assert.equal(calls[0].p_candidates.length, 0);
  await s.commit(
    {
      source: 'cline',
      complete: true,
      items: [item, { ...item, id: 'second' }],
    },
    {
      ...state,
      initialized_at: CUTOFF,
      last_success_at: CUTOFF,
      seen_keys: [digest(item.id)],
    },
    CUTOFF,
  );
  assert.equal(calls[1].p_candidates.length, 1);
  assert.equal(calls[1].p_seen.length, 2);
});
void test('Authenticated APIs reject credential forwarding to an arbitrary host', async () => {
  await assert.rejects(
    apiJson('https://unrelated.example/api', {
      headers: { Authorization: 'Bearer fixture' },
    }),
    /Unsupported API origin/,
  );
});
