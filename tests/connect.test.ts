import test from 'node:test';
import assert from 'node:assert/strict';
import { connectPlan, keyFor } from '../lib/connect.ts';
import { listingJsonLd } from '../lib/seo.ts';
import type { PublicListing } from '../lib/listing.ts';

const base: PublicListing = {
  kind: 'server',
  name: 'Exa MCP',
  summary: 'Provide web search, crawling and coding context to MCP clients.',
  description:
    'Provide web search, crawling and coding context to MCP clients. The observed registry record provides remote MCP connection details.',
  homepage: 'https://exa.ai/docs/reference/exa-mcp',
  repository: 'https://github.com/exa-labs/exa-mcp-server',
  documentation: 'https://exa.ai/docs/reference/exa-mcp',
  endpoint: 'https://mcp.exa.ai/mcp',
  category: 'Search & research',
  tags: ['mcp'],
  pricing: 'unknown',
  transport: 'streamable-http',
  authentication: 'unknown',
  platforms: [],
  license: 'MIT (repository)',
  setup: '',
  capabilities: ['Web search', 'Web crawling'],
  profileUrl: '',
  readmeUrl: '',
  slug: 'exa-mcp',
  source: 'Official MCP Registry',
  sourceUrl:
    'https://registry.modelcontextprotocol.io/v0.1/servers/ai.exa%2Fexa/versions/latest',
  observedAt: '2026-09-08',
  publishedAt: '',
  remotes: [{ type: 'streamable-http', url: 'https://mcp.exa.ai/mcp' }],
  packages: [],
};

await test('remote servers get a hosted answer and client snippets from the endpoint', () => {
  const plan = connectPlan(base);
  assert.equal(plan.key, 'exa');
  assert.match(
    plan.transportAnswer,
    /Streamable HTTP at https:\/\/mcp\.exa\.ai\/mcp/,
  );
  assert.equal(plan.snippets.length, 3);
  assert.equal(
    plan.snippets[0].code,
    'claude mcp add --transport http exa https://mcp.exa.ai/mcp',
  );
  assert.deepEqual(JSON.parse(plan.snippets[1].code), {
    mcpServers: { exa: { url: 'https://mcp.exa.ai/mcp' } },
  });
  assert.match(plan.snippets[2].code, /mcp-remote/);
  assert.match(plan.authAnswer, /Not specified/);
  assert.match(plan.pricingAnswer, /Not specified/);
});

await test('local packages get run commands, required env and honest gaps', () => {
  const plan = connectPlan({
    ...base,
    name: 'Filesystem MCP Server',
    endpoint: '',
    remotes: [],
    transport: 'stdio',
    authentication: 'none',
    pricing: 'open-source',
    packages: [
      {
        registryType: 'npm',
        identifier: '@modelcontextprotocol/server-filesystem',
        version: '2026.1.1',
        environmentVariables: [{ name: 'ROOT_DIR', isRequired: true }],
      },
    ],
  });
  assert.equal(plan.key, 'filesystem');
  assert.match(
    plan.transportAnswer,
    /npm package @modelcontextprotocol\/server-filesystem \(version 2026\.1\.1\) over stdio/,
  );
  assert.equal(
    plan.snippets[0].code,
    'claude mcp add filesystem -e ROOT_DIR=<value> -- npx -y @modelcontextprotocol/server-filesystem',
  );
  assert.deepEqual(JSON.parse(plan.snippets[1].code).mcpServers.filesystem, {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    env: { ROOT_DIR: '<value>' },
  });
  assert.match(plan.authAnswer, /No credentials/);
  assert.match(plan.pricingAnswer, /Open source/);
  const bare = connectPlan({
    ...base,
    endpoint: '',
    remotes: [],
    packages: [],
  });
  assert.equal(bare.snippets.length, 0);
  assert.match(
    bare.transportAnswer,
    /has not listed a hosted endpoint or a package/,
  );
  assert.equal(keyFor('GitHub MCP Server'), 'github');
});

await test('structured data carries only stored facts and never ratings', () => {
  const ld = listingJsonLd(
    base,
    'https://ruagentic.com/tools/exa-mcp',
  ) as Record<string, unknown>;
  assert.equal(ld['@type'], 'SoftwareApplication');
  assert.equal(ld.mainEntityOfPage, 'https://ruagentic.com/tools/exa-mcp');
  assert.deepEqual(ld.sameAs, [base.repository, base.documentation]);
  assert.ok(!('offers' in ld), 'unknown pricing gets no offer');
  assert.ok(!('aggregateRating' in ld));
  const props = ld.additionalProperty as { name: string; value: string }[];
  assert.deepEqual(
    props.map((p) => [p.name, p.value]),
    [
      ['MCP endpoint', 'https://mcp.exa.ai/mcp'],
      ['MCP transport', 'streamable-http'],
      ['License', 'MIT (repository)'],
    ],
  );
  const free = listingJsonLd(
    { ...base, pricing: 'free' },
    'https://ruagentic.com/tools/exa-mcp',
  ) as Record<string, unknown>;
  assert.deepEqual(free.offers, {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'USD',
  });
  assert.equal(free.isAccessibleForFree, true);
});

await test('products with an agent card get a connect answer and structured data', () => {
  const product = {
    ...base,
    kind: 'product' as const,
    name: 'Helper Agent',
    endpoint: '',
    remotes: [],
    packages: [],
    transport: 'not-applicable' as const,
    authentication: 'api-key' as const,
    agentCard: 'https://agent.example.com/.well-known/agent.json',
    agentProtocol: 'a2a' as const,
  };
  const plan = connectPlan(product);
  assert.deepEqual(plan.agent, {
    url: 'https://agent.example.com/.well-known/agent.json',
    protocol: 'a2a',
    label: 'A2A (agent card)',
  });
  assert.equal(connectPlan({ ...product, agentCard: '' }).agent, null);
  const ld = listingJsonLd(
    product,
    'https://ruagentic.com/tools/helper-agent',
  ) as Record<string, unknown>;
  const props = ld.additionalProperty as { name: string; value: string }[];
  assert.ok(
    props.some((p) => p.name === 'Agent card' && p.value === product.agentCard),
  );
  assert.ok(
    props.some((p) => p.name === 'Agent protocol' && p.value === 'a2a'),
  );
});
