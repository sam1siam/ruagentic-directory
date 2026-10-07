import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  homeMarkdown,
  markdownResponse,
  notFoundMarkdown,
  problem,
  problemResponse,
  problemTypes,
} from '../lib/agent-responses.ts';
import { organizationJsonLd } from '../lib/seo.ts';
import nextConfig from '../next.config.ts';

const read = (path: string) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');

await test('problems follow RFC 9457 and keep the old error field', async () => {
  const body = problem('listing_not_found', 'Listing not found.');
  assert.equal(
    body.type,
    'https://ruagentic.com/developers#error-listing-not-found',
  );
  assert.equal(body.status, 404);
  assert.equal(body.title, 'Listing not found');
  assert.equal(body.detail, 'Listing not found.');
  assert.equal(body.error, body.detail);
  assert.equal(body.code, 'listing_not_found');
  assert.ok(body.hint.length > 20);

  const res = problemResponse('directory_unavailable', 'Down.');
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('content-type'), 'application/problem+json');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal((await res.json()).code, 'directory_unavailable');
});

await test('every problem code is documented on the developer page', () => {
  const page = read('app/developers/page.tsx');
  for (const code of Object.keys(problemTypes)) {
    assert.ok(page.includes(`id="error-${code.replaceAll('_', '-')}"`), code);
    assert.ok(page.includes(`<code>${code}</code>`), code);
  }
  assert.ok(page.includes('id="versioning"'));
});

await test('the Markdown 404 explains itself and links onward', async () => {
  const text = notFoundMarkdown();
  assert.match(text, /^# Page not found \(404\)/);
  assert.ok(text.length >= 20);
  assert.ok(text.includes('https://ruagentic.com/llms.txt'));
  assert.ok(text.includes('https://ruagentic.com/sitemap.xml'));
  const res = markdownResponse(text, 404);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(res.headers.get('vary'), 'Accept');
});

await test('the Markdown homepage puts live counts before the first section', () => {
  const overview =
    '# Site\n\n> Summary.\n\n## Discover\n- [A](https://a.example/): a\n';
  const text = homeMarkdown(
    overview,
    [
      {
        name: 'MCP servers',
        slug: 'servers',
        description: 'Servers.',
        count: 3,
      },
      { name: 'Skills', slug: 'skills', description: 'Skills.', count: 2 },
    ],
    [{ name: 'Security', slug: 'security', description: 'Sec.', count: 1 }],
  );
  assert.match(text, /^# Site\n\n> Summary\./);
  assert.ok(
    text.includes('> Summary.\n\n## In the directory now\n5 public listings.'),
  );
  assert.ok(
    text.includes(
      '- [MCP servers](https://ruagentic.com/servers): 3. Servers.',
    ),
  );
  assert.ok(
    text.includes(
      '- [Security](https://ruagentic.com/categories/security): 1 listings.',
    ),
  );
  assert.ok(
    text.indexOf('## In the directory now') < text.indexOf('## Discover'),
  );
});

await test('Markdown readers are routed to Markdown, browsers are not', async () => {
  const rewrites = (await nextConfig.rewrites!()) as {
    beforeFiles: {
      source: string;
      destination: string;
      has: { value: string }[];
    }[];
    fallback: {
      source: string;
      destination: string;
      has: { value: string }[];
    }[];
  };
  const home = rewrites.beforeFiles.find((r) => r.source === '/')!;
  const missing = rewrites.fallback.find((r) => r.source === '/:path*')!;
  assert.equal(home.destination, '/index.md');
  assert.equal(missing.destination, '/missing.md');
  // Next anchors header patterns as ^…$.
  const matches = (accept: string) =>
    new RegExp(`^${home.has[0]!.value}$`).test(accept);
  assert.ok(matches('text/markdown'));
  assert.ok(matches('text/markdown, text/html;q=0.9, */*;q=0.8'));
  assert.ok(
    !matches(
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    ),
  );
  assert.ok(!matches('application/json'));
  assert.equal(missing.has[0]!.value, home.has[0]!.value);

  const redirects = await nextConfig.redirects!();
  for (const source of ['/docs', '/api'])
    assert.equal(
      redirects.find((r) => r.source === source)?.destination,
      '/developers',
    );
});

await test('llms.txt keeps its format and says when to use the directory', () => {
  const text = read('public/llms.txt');
  const lines = text.split('\n');
  assert.match(lines[0]!, /^# RUAGENTIC Directory$/);
  assert.match(lines[2]!, /^> /);
  const section = text.split('## When to use\n')[1]!.split('\n## ')[0]!;
  const items = section.trim().split('\n');
  assert.ok(items.length >= 5);
  for (const item of items)
    assert.match(item, /^- \[[^\]]+\]\(https:\/\/[^)]+\): .+/);
  assert.ok(section.includes('npx ruagentic'));
  assert.ok(section.includes('/api/v1/listings'));
  assert.ok(section.includes('https://ruagentic.com/mcp'));
  // Free text sits between the blockquote and the first section only.
  assert.ok(text.indexOf('Reach for RUAGENTIC') < text.indexOf('\n## '));
});

await test('the OpenAPI description types every error response', () => {
  const spec = JSON.parse(read('public/openapi.json'));
  const schema = spec.components.schemas.Problem;
  assert.deepEqual(schema.required, [
    'type',
    'title',
    'status',
    'detail',
    'code',
  ]);
  assert.deepEqual(schema.properties.code.enum, Object.keys(problemTypes));
  const resolve = (r: { $ref?: string }) =>
    r.$ref ? spec.components.responses[r.$ref.split('/').at(-1)!] : r;
  for (const [path, ops] of Object.entries(spec.paths))
    for (const op of Object.values(
      ops as Record<string, { responses: Record<string, object> }>,
    ))
      for (const [status, response] of Object.entries(op.responses)) {
        if (Number(status) < 400) continue;
        const content = resolve(response as { $ref?: string }).content;
        assert.equal(
          content['application/problem+json'].schema.$ref,
          '#/components/schemas/Problem',
          path + ' ' + status,
        );
      }
  assert.match(spec.info.description, /Deprecation header \(RFC 9745\)/);
  assert.match(spec.info.description, /Sunset header \(RFC 8594\)/);
});

await test('the organisation block has a description and a contact point', () => {
  const org = organizationJsonLd();
  assert.ok(org.description.length > 50);
  assert.deepEqual(org.contactPoint, {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: 'https://ruagentic.com/contact',
    availableLanguage: 'English',
  });
  assert.equal(
    organizationJsonLd('help@example.com').contactPoint.email,
    'help@example.com',
  );
  assert.equal('address' in org, false);
});
