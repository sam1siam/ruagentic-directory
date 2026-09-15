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
  SOURCES,
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
  officialSnapshot,
  githubSnapshot,
  hackerNewsSnapshot,
  parseGithubSearch,
  parseHackerNewsItem,
} from '../lib/discovery/sources.ts';
import {
  belongsToCompany,
  findContact,
  founderEmail,
  founderRecord,
  isFounderTitle,
  publishedContacts,
  verifiedFounder,
} from '../lib/discovery/contacts.ts';
import { leadPayload, Smartlead } from '../lib/discovery/smartlead.ts';
import { DiscoveryStore, type Contact } from '../lib/discovery/store.ts';
import { dailyLimit, runDiscovery } from '../lib/discovery/run.ts';
import {
  ProviderCooldown,
  ProviderError,
  apiJson,
  providerHold,
  readPage,
  resetRobotsCache,
} from '../lib/discovery/http.ts';
import { ProviderPacer } from '../lib/discovery/rate-limit.ts';
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
void test('Founder lookups accept only personal founder mailboxes', () => {
  assert.equal(founderEmail('pat@example.com', 'example.com'), true);
  for (const email of [
    'support@example.com',
    'hello@example.com',
    'team+sales@example.com',
    'founders@example.com',
    'pat@other.com',
  ])
    assert.equal(founderEmail(email, 'example.com'), false);
  assert.equal(isFounderTitle('Co-founder & CEO'), true);
  for (const title of [
    'Former founder',
    'Founder in Residence',
    'Product owner',
    'Engineer',
  ])
    assert.equal(isFounderTitle(title), false);
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
void test('The provider pacer spaces every call and honours rate-limit headers', async () => {
  let now = 1_000_000;
  const sleeps: number[] = [];
  const pacer = new ProviderPacer({
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  });
  const search = new URL('https://api.prospeo.io/search-person');
  await pacer.wait(search, now + 600_000);
  await pacer.wait(search, now + 600_000);
  assert.deepEqual(sleeps, [3100]);
  assert.ok(
    pacer.observe(search, new Headers({ 'retry-after': '120' }), 429) >= 120,
  );
  await assert.rejects(pacer.wait(search, now + 60_000), ProviderCooldown);
  pacer.observe(
    search,
    new Headers({
      'x-daily-request-left': '0',
      'x-daily-reset-seconds': '3600',
    }),
    200,
  );
  assert.equal(pacer.snapshot()['prospeo:search']?.dailyLeft, 0);
  assert.equal(
    await pacer.wait(new URL('https://example.com/'), now),
    undefined,
  );
});
void test('Provider limits hold a candidate; ordinary failures do not', () => {
  assert.equal(providerHold(new ProviderError('api.prospeo.io', 429)), true);
  assert.equal(providerHold(new ProviderError('app.findymail.com', 402)), true);
  assert.equal(providerHold(new ProviderError('api.prospeo.io', 500)), false);
  assert.equal(providerHold(new ProviderError('example.com', 429)), false);
  assert.equal(providerHold(new ProviderCooldown('prospeo:search', 90)), true);
  assert.equal(providerHold(new Error('redirect')), false);
});
void test('A Prospeo rate limit stops the lookup instead of spending Findymail credits', async () => {
  const previous = [process.env.PROSPEO_API_KEY, process.env.FINDYMAIL_API_KEY];
  process.env.PROSPEO_API_KEY = 'fixture';
  process.env.FINDYMAIL_API_KEY = 'fixture';
  try {
    const limited: string[] = [];
    await assert.rejects(
      findContact(
        item,
        Date.now() + 60_000,
        async () => true,
        async (url) => {
          limited.push(new URL(url).hostname);
          throw new ProviderError('api.prospeo.io', 429);
        },
      ),
      /429/,
    );
    assert.deepEqual(limited, ['api.prospeo.io']);
    const outage: string[] = [];
    await assert.rejects(
      findContact(
        item,
        Date.now() + 60_000,
        async () => true,
        async (url) => {
          const host = new URL(url).hostname;
          outage.push(host);
          if (host === 'api.prospeo.io')
            throw new ProviderError('api.prospeo.io', 500);
          return [];
        },
      ),
      /500/,
    );
    assert.deepEqual(outage, ['api.prospeo.io', 'app.findymail.com']);
  } finally {
    process.env.PROSPEO_API_KEY = previous[0];
    process.env.FINDYMAIL_API_KEY = previous[1];
    if (previous[0] === undefined) delete process.env.PROSPEO_API_KEY;
    if (previous[1] === undefined) delete process.env.FINDYMAIL_API_KEY;
  }
});
void test('Discovery reads follow HTTPS redirects, including robots.txt redirects', async () => {
  type Page = { status: number; location?: string; text?: string };
  const fake = (
    pages: Record<string, Page>,
    fallback?: (url: string) => Page,
  ) =>
    (async (url: string) => {
      const page = pages[url] ?? fallback?.(url);
      if (!page) throw new Error('unexpected read ' + url);
      return {
        url,
        status: page.status,
        text: page.text ?? '',
        contentType: 'text/html',
        location: page.location,
      };
    }) as unknown as Parameters<typeof readPage>[4];
  resetRobotsCache();
  const page = await readPage(
    'https://upcampo.com.br/',
    Date.now() + 60_000,
    true,
    500_000,
    fake({
      'https://upcampo.com.br/robots.txt': {
        status: 200,
        text: 'User-agent: *\nAllow: /',
      },
      'https://upcampo.com.br/': {
        status: 301,
        location: 'https://www.upcampo.com.br/',
      },
      'https://www.upcampo.com.br/robots.txt': {
        status: 302,
        location: 'https://partners.example.com/login',
      },
      'https://partners.example.com/login': {
        status: 200,
        text: '<html>Sign in</html>',
      },
      'https://www.upcampo.com.br/': { status: 200, text: '<h1>UPi</h1>' },
    }),
  );
  assert.equal(page.url, 'https://www.upcampo.com.br/');
  assert.match(page.text, /UPi/);
  resetRobotsCache();
  await assert.rejects(
    readPage(
      'https://blocked.example/',
      Date.now() + 60_000,
      true,
      1000,
      fake({
        'https://blocked.example/robots.txt': {
          status: 200,
          text: 'User-agent: *\nDisallow: /',
        },
      }),
    ),
    /robots\.txt disallows/,
  );
  await assert.rejects(
    readPage(
      'https://loop.example/',
      Date.now() + 60_000,
      false,
      1000,
      fake({}, (url) => ({ status: 302, location: url + 'a' })),
    ),
    /more than 5 redirects/,
  );
  await assert.rejects(
    readPage(
      'https://down.example/',
      Date.now() + 60_000,
      false,
      1000,
      fake({
        'https://down.example/': {
          status: 301,
          location: 'http://down.example/',
        },
      }),
    ),
    /usable HTTPS location/,
  );
});
void test('Work order puts found contacts first and caps cooled-down retries ahead of new projects', async () => {
  const rows: Record<string, { id: string; data?: unknown }[]> = {
    contact_ready: [{ id: 'ready' }],
    retry: [{ id: 'retry-1' }, { id: 'retry-2' }],
    pending: [
      // Oldest first, but a repository-only GitHub result ranks below a
      // project with its own website, and an unresolved registry entry
      // (repository only) sits between them.
      {
        id: 'new-repo-only',
        data: {
          source: 'github',
          repository: 'https://github.com/x/y',
        },
      },
      {
        id: 'new-registry',
        data: {
          source: 'official-registry',
          repository: 'https://github.com/x/z',
        },
      },
      { id: 'new-site', data: { homepage: 'https://acme.dev' } },
    ],
  };
  const filters: string[] = [];
  const db = {
    from: () => {
      let status = '';
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          if (column === 'status') status = value;
          return query;
        },
        lt: (column: string, value: unknown) => {
          filters.push(`${column}<${String(value)}`);
          return query;
        },
        order: () => query,
        limit: (n: number) => {
          filters.push(`${status} limit ${n}`);
          return Promise.resolve({ data: rows[status], error: null });
        },
      };
      return query;
    },
  } as unknown as ConstructorParameters<typeof DiscoveryStore>[0];
  const work = await new DiscoveryStore(db).pending(
    5,
    new Date('2026-09-13T12:00:00Z'),
  );
  assert.deepEqual(
    work.map((r) => r.id),
    ['ready', 'retry-1', 'retry-2', 'new-site', 'new-registry'],
  );
  assert.ok(filters.includes('attempts<3'));
  assert.ok(filters.includes('updated_at<2026-09-12T16:00:00.000Z'));
  assert.ok(filters.includes('retry limit 5'));
  assert.ok(filters.includes('pending limit 1000'));
});
void test('The daily limit accepts up to 100 and rejects anything else', () => {
  const previous = process.env.DISCOVERY_DAILY_LIMIT;
  try {
    delete process.env.DISCOVERY_DAILY_LIMIT;
    assert.equal(dailyLimit(), 50);
    process.env.DISCOVERY_DAILY_LIMIT = '100';
    assert.equal(dailyLimit(), 100);
    process.env.DISCOVERY_DAILY_LIMIT = '101';
    assert.throws(dailyLimit, /1 to 100/);
    process.env.DISCOVERY_DAILY_LIMIT = '2.5';
    assert.throws(dailyLimit, /1 to 100/);
  } finally {
    if (previous === undefined) delete process.env.DISCOVERY_DAILY_LIMIT;
    else process.env.DISCOVERY_DAILY_LIMIT = previous;
  }
});
void test('Registry histories are read several at a time and failed reads are left for the next run', async () => {
  const servers = Array.from({ length: 9 }, (_, i) => `io.example/server-${i}`);
  const meta = (publishedAt: string) => ({
    'io.modelcontextprotocol.registry/official': {
      status: 'active',
      publishedAt,
    },
  });
  const listing = (names: string[], nextCursor = '') =>
    JSON.stringify({
      servers: names.map((name) => ({
        server: {
          name,
          title: name,
          description: 'An MCP server',
          websiteUrl: `https://${name.split('/')[1]}.example.com`,
        },
        _meta: meta('2026-09-12T10:00:00Z'),
      })),
      metadata: nextCursor ? { nextCursor } : {},
    });
  const history = (dates: string[]) =>
    JSON.stringify({
      servers: dates.map((d) => ({ server: { name: 'x' }, _meta: meta(d) })),
    });
  let active = 0,
    peak = 0;
  const histories: string[] = [];
  const read = async (url: string) => {
    const u = new URL(url);
    if (u.pathname === '/v0.1/servers')
      return {
        text: u.searchParams.get('cursor')
          ? listing(servers.slice(5))
          : listing(servers.slice(0, 5), 'page-2'),
      };
    const name = decodeURIComponent(
      u.pathname.replace('/v0.1/servers/', '').replace('/versions', ''),
    );
    active++;
    peak = Math.max(peak, active);
    histories.push(name);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    if (name.endsWith('-7'))
      throw new Error('The page took too long to respond.');
    return {
      text: history(
        name.endsWith('-3')
          ? ['2026-09-12T10:00:00Z', '2025-01-01T00:00:00Z']
          : ['2026-09-12T10:00:00Z'],
      ),
    };
  };
  const result = await officialSnapshot(
    Date.now() + 60_000,
    new Set([digest('io.example/server-0')]),
    CUTOFF,
    read,
  );
  assert.ok(peak > 1 && peak <= 4, `peak concurrency ${peak}`);
  assert.equal(histories.includes('io.example/server-0'), false);
  assert.equal(result.complete, false);
  assert.match(result.error ?? '', /^1 registry server could not be read/);
  assert.deepEqual(
    result.items.map((i) => i.id).sort(),
    servers
      .slice(1)
      .filter((n) => !n.endsWith('-7'))
      .sort(),
  );
  assert.equal(
    result.items.find((i) => i.id.endsWith('-3'))?.publishedAt,
    '2025-01-01T00:00:00Z',
  );
  const done = await officialSnapshot(
    Date.now() + 60_000,
    new Set(servers.map(digest)),
    CUTOFF,
    read,
  );
  assert.deepEqual(done, { items: [], complete: true });
  const late = await officialSnapshot(
    Date.now() + 10_000,
    new Set(),
    CUTOFF,
    read,
  );
  assert.equal(late.complete, false);
  assert.match(late.error ?? '', /time limit/);
});
void test('Partial progress saves new dated candidates without moving the source window', async () => {
  const writes: { table: string; op: string; value: unknown }[] = [];
  const db = {
    from: (table: string) => ({
      upsert: async (value: unknown) => {
        writes.push({ table, op: 'upsert', value });
        return { error: null };
      },
      update: (value: unknown) => ({
        eq: async () => {
          writes.push({ table, op: 'update', value });
          return { error: null };
        },
      }),
    }),
  } as unknown as ConstructorParameters<typeof DiscoveryStore>[0];
  const store = new DiscoveryStore(db);
  const state = {
    source: 'official-registry' as const,
    initialized_at: CUTOFF,
    last_success_at: CUTOFF,
    seen_keys: [digest('io.example/already-seen')],
  };
  const fresh = {
    ...item,
    source: 'official-registry' as const,
    id: 'io.example/new',
    publishedAt: '2026-09-12T10:00:00Z',
    dateEvidence:
      'Earliest publishedAt across complete registry version history',
  };
  const old = {
    ...fresh,
    id: 'io.example/old',
    publishedAt: '2025-01-01T00:00:00Z',
  };
  const saved = await store.commitPartial(
    {
      source: 'official-registry',
      items: [fresh, old],
      complete: false,
      partial: true,
      error: 'Registry read stopped at the time limit; progress saved',
    },
    state,
    '2026-09-13T12:00:00Z',
  );
  assert.equal(saved.newCandidates, 1);
  assert.deepEqual(
    writes.map((w) => `${w.op} ${w.table}`),
    ['upsert discovery_candidates', 'update discovery_sources'],
  );
  assert.equal((writes[0]!.value as unknown[]).length, 1);
  const progress = writes[1]!.value as Record<string, unknown>;
  assert.equal('last_success_at' in progress, false);
  assert.equal('initialized_at' in progress, false);
  assert.equal((progress.seen_keys as string[]).length, 3);
  await assert.rejects(
    store.commitPartial(
      { source: 'pulsemcp', items: [item], complete: false, partial: true },
      { ...state, source: 'pulsemcp' },
      CUTOFF,
    ),
    /Only dated sources/,
  );
});
void test('Candidates start before the slowest source finishes, and a partial registry read is kept', async () => {
  const keys = [
    'DISCOVERY_ENRICHMENT_ENABLED',
    'PROSPEO_API_KEY',
    'SMARTLEAD_API_KEY',
  ] as const;
  const previous = keys.map((k) => process.env[k]);
  process.env.DISCOVERY_ENRICHMENT_ENABLED = 'true';
  process.env.PROSPEO_API_KEY = 'fixture';
  process.env.SMARTLEAD_API_KEY = 'fixture';
  const events: string[] = [];
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let finished:
    | { status?: string; sources: { source: string; status: string }[] }
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
    commit: async () => ({ observed: 1, newCandidates: 0, baseline: false }),
    commitPartial: async () => {
      events.push('partial saved');
      return { observed: 1, newCandidates: 1, baseline: false, partial: true };
    },
    outreach: async () => [],
    pending: async () => {
      events.push('candidates started');
      release();
      return [];
    },
    finish: async (_day: string, _owner: string, report: typeof finished) => {
      finished = report;
    },
  } as unknown as DiscoveryStore;
  try {
    await runDiscovery({
      store,
      now: new Date('2026-09-13T12:00:00Z'),
      account: async () => null,
      snapshot: async (source) => {
        await released;
        events.push('source ' + source);
        return source === 'official-registry'
          ? {
              source,
              items: [
                {
                  ...item,
                  source,
                  id: 'io.example/new',
                  publishedAt: CUTOFF,
                  dateEvidence: 'history',
                },
              ],
              complete: false,
              partial: true,
              error: 'Registry read stopped at the time limit; progress saved',
            }
          : { source, items: [item], complete: true };
      },
    });
  } finally {
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
  }
  assert.equal(events[0], 'candidates started');
  assert.ok(events.includes('partial saved'));
  assert.equal(finished?.sources.length, SOURCES.length);
  assert.equal(
    finished?.sources.find((s) => s.source === 'official-registry')?.status,
    'partial',
  );
});
void test('Registry throttling pauses the readers and retries instead of failing servers', async () => {
  const meta = {
    'io.modelcontextprotocol.registry/official': {
      status: 'active',
      publishedAt: '2026-09-12T10:00:00Z',
    },
  };
  const listing = JSON.stringify({
    servers: [
      {
        server: { name: 'io.example/busy', description: 'An MCP server' },
        _meta: meta,
      },
    ],
    metadata: {},
  });
  const history = JSON.stringify({
    servers: [{ server: { name: 'io.example/busy' }, _meta: meta }],
  });
  let throttledOnce = false;
  const waits: number[] = [];
  const recovers = async (url: string) => {
    if (new URL(url).pathname === '/v0.1/servers') return { text: listing };
    if (!throttledOnce) {
      throttledOnce = true;
      throw new ProviderError('registry.modelcontextprotocol.io', 429);
    }
    return { text: history };
  };
  const result = await officialSnapshot(
    Date.now() + 60_000,
    new Set(),
    CUTOFF,
    recovers,
    async (ms) => {
      waits.push(ms);
    },
  );
  assert.equal(result.complete, true);
  assert.deepEqual(
    result.items.map((i) => i.id),
    ['io.example/busy'],
  );
  assert.equal(waits.length, 1);
  assert.ok(waits[0]! > 1000 && waits[0]! <= 2000, `waited ${waits[0]}`);
  let attempts = 0;
  const neverRecovers = async (url: string) => {
    if (new URL(url).pathname === '/v0.1/servers') return { text: listing };
    attempts++;
    throw new ProviderError('registry.modelcontextprotocol.io', 429);
  };
  const stuck = await officialSnapshot(
    Date.now() + 60_000,
    new Set(),
    CUTOFF,
    neverRecovers,
    async () => {},
  );
  assert.equal(attempts, 5);
  assert.equal(stuck.complete, false);
  assert.match(stuck.error ?? '', /^1 registry server could not be read/);
});
void test('Published hello@ and support@ addresses on the company domain are the fallback', () => {
  const html =
    '<body><a href="mailto:support@example.com">Support</a> <a href="mailto:hello@example.com?subject=hi">Say hi</a> <a href="mailto:sales@example.com">Sales</a> <a href="mailto:hello@other.com">Partner</a><footer>Or write to support@example.com</footer></body>';
  assert.deepEqual(
    publishedContacts(html, 'https://example.com', 'example.com').map(
      (c) => c.email,
    ),
    ['hello@example.com', 'support@example.com'],
  );
  assert.deepEqual(
    publishedContacts(
      '<body><p>No unsolicited sales emails.</p><a href="mailto:hello@example.com">Hi</a></body>',
      'https://example.com/contact',
      'example.com',
    ),
    [],
  );
});
void test('Without a founder, a published hello@ address verified by Findymail is used', async () => {
  const previous = [process.env.PROSPEO_API_KEY, process.env.FINDYMAIL_API_KEY];
  process.env.PROSPEO_API_KEY = 'fixture';
  process.env.FINDYMAIL_API_KEY = 'fixture';
  try {
    const calls: string[] = [];
    const found = await findContact(
      item,
      Date.now() + 60_000,
      async () => true,
      async (url, init) => {
        const u = new URL(url);
        calls.push(u.hostname + u.pathname);
        if (u.pathname === '/search-person') return { results: [] };
        if (u.pathname === '/api/search/employees') return [];
        if (u.pathname === '/api/verify')
          return {
            email:
              typeof init?.body === 'string' ? JSON.parse(init.body).email : '',
            verified: true,
          };
        throw new Error('unexpected ' + url);
      },
      (async (url: string) => ({
        url,
        status: 200,
        contentType: 'text/html',
        text: '<body><a href="mailto:hello@example.com">Hello</a></body>',
      })) as unknown as Parameters<typeof findContact>[4],
    );
    assert.equal(found?.email, 'hello@example.com');
    assert.equal(
      found?.provider,
      'Published business contact, Findymail verified',
    );
    assert.deepEqual(calls, [
      'api.prospeo.io/search-person',
      'app.findymail.com/api/search/employees',
      'app.findymail.com/api/verify',
    ]);
  } finally {
    process.env.PROSPEO_API_KEY = previous[0];
    process.env.FINDYMAIL_API_KEY = previous[1];
    if (previous[0] === undefined) delete process.env.PROSPEO_API_KEY;
    if (previous[1] === undefined) delete process.env.FINDYMAIL_API_KEY;
  }
});
void test('Show HN posts become dated candidates; other stories are ignored', async () => {
  const time = Date.parse('2026-09-12T15:00:00Z') / 1000;
  const repo = parseHackerNewsItem({
    id: 101,
    type: 'story',
    time,
    title: 'Show HN: Astah Pro MCP – Enabling AI-powered UML modeling',
    url: 'https://github.com/takaakit/astah-pro-mcp',
  });
  assert.equal(repo?.name, 'Astah Pro MCP');
  assert.equal(repo?.repository, 'https://github.com/takaakit/astah-pro-mcp');
  assert.equal(repo?.homepage, undefined);
  assert.equal(repo?.publishedAt, '2026-09-12T15:00:00.000Z');
  assert.equal(repo?.sourceUrl, 'https://news.ycombinator.com/item?id=101');
  const site = parseHackerNewsItem({
    id: 102,
    type: 'story',
    time,
    title: 'Show HN: Clawfight – MCP-driven agentic game play',
    url: 'https://clawfight.ai/agents.md',
    text: '<p>Built with <i>agents</i></p>',
  });
  assert.equal(site?.homepage, 'https://clawfight.ai/agents.md');
  assert.match(site?.description ?? '', /Built with agents/);
  for (const value of [
    { id: 103, type: 'story', time, title: 'Ask HN: Which MCP servers?' },
    { id: 104, type: 'story', time, title: 'Show HN: X', dead: true },
    { id: 105, type: 'comment', time, title: 'Show HN: Y' },
    null,
  ])
    assert.equal(parseHackerNewsItem(value), undefined);
  const posts: Record<string, unknown> = {
    '101': {
      id: 101,
      type: 'story',
      time,
      title: 'Show HN: A',
      url: 'https://a.example.com',
    },
    '103': { id: 103, type: 'story', time, title: 'Ask HN: B' },
  };
  const read = async (url: string) => ({
    text: url.endsWith('showstories.json')
      ? '[101, 103, 104]'
      : JSON.stringify(posts[url.match(/item\/(\d+)\.json/)![1]!] ?? null),
  });
  const snap = await hackerNewsSnapshot(
    Date.now() + 60_000,
    new Set([digest('104')]),
    read,
  );
  assert.equal(snap.complete, true);
  assert.deepEqual(
    snap.items.map((i) => i.id),
    ['101'],
  );
});
void test('GitHub topic search yields new, non-fork repositories once each', async () => {
  const repo = (full: string, extra: Record<string, unknown> = {}) => ({
    full_name: full,
    name: full.split('/')[1],
    html_url: `https://github.com/${full}`,
    private: false,
    visibility: 'public',
    description: 'An MCP server',
    homepage: null,
    fork: false,
    archived: false,
    created_at: '2026-09-12T10:00:00Z',
    topics: [],
    ...extra,
  });
  const urls: string[] = [];
  const api = async (url: string) => {
    urls.push(url);
    const topic = new URL(url).searchParams.get('q')!.split(' ')[0];
    return topic === 'topic:mcp-server'
      ? {
          total_count: 2,
          incomplete_results: false,
          items: [
            repo('Acme/Tool', { homepage: 'https://acme.dev' }),
            repo('old/one', { created_at: '2025-01-01T00:00:00Z' }),
          ],
        }
      : {
          total_count: 3,
          incomplete_results: false,
          items: [
            repo('acme/tool'),
            repo('fork/copy', { fork: true }),
            repo('new/client', {
              topics: ['mcp-client'],
              homepage: 'https://client.example',
            }),
            // No website: nothing to contact, so it never enters the queue.
            repo('hobby/server'),
            repo('pages/only', { homepage: 'https://pages.github.io/x' }),
          ],
        };
  };
  const snap = await githubSnapshot(
    Date.now() + 60_000,
    new Set(),
    '2026-09-11T11:17:00.000Z',
    api,
  );
  assert.equal(snap.complete, true);
  assert.deepEqual(
    snap.items.map((i) => i.id),
    ['acme/tool', 'new/client'],
  );
  assert.equal(snap.items[0]!.kind, 'mcp-server');
  assert.equal(snap.items[0]!.homepage, 'https://acme.dev');
  assert.equal(snap.items[1]!.kind, undefined);
  assert.equal(
    new URL(urls[0]!).searchParams.get('q'),
    'topic:mcp-server created:>=2026-09-11T11:17:00Z fork:false archived:false is:public',
  );
  assert.equal(
    parseGithubSearch(
      {
        total_count: 1,
        incomplete_results: false,
        items: [repo('x/y', { homepage: 'https://xy.example' })],
      },
      'mcp-server',
    )[0]!.dateEvidence,
    'GitHub repository creation time',
  );
  const tooMany = await githubSnapshot(
    Date.now() + 60_000,
    new Set(),
    '2026-09-11T11:17:00.000Z',
    async () => ({ total_count: 1500, incomplete_results: false, items: [] }),
  );
  assert.equal(tooMany.complete, false);
});
void test('GitHub limits pace searches and hold candidates without stopping outreach', async () => {
  let now = 5_000_000;
  const sleeps: number[] = [];
  const pacer = new ProviderPacer({
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  });
  const search = new URL('https://api.github.com/search/repositories');
  await pacer.wait(search, now + 600_000);
  await pacer.wait(search, now + 600_000);
  assert.deepEqual(sleeps, [process.env.GITHUB_TOKEN ? 2100 : 6500]);
  pacer.observe(
    search,
    new Headers({
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.ceil(now / 1000) + 120),
    }),
    403,
  );
  await assert.rejects(pacer.wait(search, now + 60_000), ProviderCooldown);
  assert.equal(pacer.snapshot()['github:search']?.remaining, 0);
  assert.equal(providerHold(new ProviderError('api.github.com', 403)), true);
});
