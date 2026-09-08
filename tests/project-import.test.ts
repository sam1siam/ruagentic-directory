import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDocument,
  mergeSuggestions,
  plain,
} from '../lib/project-import.ts';
import { importProject } from '../lib/server/import-project.ts';
import { emptyListing } from '../lib/listing.ts';
const home = 'https://project.example/';
const summary =
  'A tool that connects useful project data to assistants and supports automated workflows.';
await test('HTML extraction uses public metadata and explicit source links; rejects dependencies and unsafe URLs', () => {
  const data = extractDocument(
    `<title>Fallback</title><meta property="og:site_name" content="Project &amp; Co"><meta name=description content="${summary}"><p>${summary}</p><script>doNotImport()</script><a href="https://github.com/facebook/react">Built with React</a><a href="https://github.com/owner/project">Source code</a><a href="/docs">Documentation</a><a href="http://127.0.0.1/agentic.json">profile</a>`,
    'text/html',
    home,
  );
  assert.equal(data.suggestions.name, 'Project & Co');
  assert.equal(data.suggestions.repository, 'https://github.com/owner/project');
  assert.equal(data.suggestions.documentation, home + 'docs');
  assert.doesNotMatch(data.suggestions.description!, /doNotImport/);
  assert.equal(
    data.links.some((x) => x.url.includes('facebook')),
    false,
  );
  assert.equal(
    data.links.some((x) => x.url.includes('127.0.0.1')),
    false,
  );
  assert.equal(plain('A&#x202e;B\u0000<script>secret</script>'), 'A B');
});
await test('structured metadata, README instructions and explicit capabilities import without executing code', () => {
  const jsonld = extractDocument(
    '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'SoftwareApplication',
        name: 'JSON tool',
        description: summary,
        codeRepository: 'https://github.com/owner/tool',
      }) +
      '</script>',
    'text/html',
    home,
  );
  assert.equal(jsonld.suggestions.name, 'JSON tool');
  const doc = extractDocument(
    '# Test\n\n' +
      summary +
      '\n\n## Installation\n\n```sh\nnpx project-tool\n```\n\n## Features\n\n- Search data\n- Export results\n',
    'text/markdown',
    home + 'README.md',
  );
  assert.match(doc.suggestions.setup!, /npx project-tool/);
  assert.deepEqual(doc.suggestions.capabilities, [
    'Search data',
    'Export results',
  ]);
  assert.equal(doc.suggestions.readmeUrl, home + 'README.md');
  assert.deepEqual(
    extractDocument('{invalid', 'application/json', home + 'openapi.json')
      .suggestions,
    {},
  );
  const intro = extractDocument(
    '# Project\n\n> ' + summary + '\n\n## Documentation\n- [Docs](/docs)',
    'text/plain',
    home + 'llms.txt',
  );
  assert.equal(intro.suggestions.summary, summary);
  assert.deepEqual(
    extractDocument(
      JSON.stringify({
        agentic: '1.0.0',
        origin: 'https://foreign.example',
        actions: [{ id: 'wrong' }],
      }),
      'application/json',
      home + 'agentic.json',
    ).suggestions,
    {},
  );
});
await test('merging suggestions preserves manual edits and intentional blanks', () => {
  const current = { ...emptyListing, name: 'My own name', summary: '' };
  const result = mergeSuggestions(
    current,
    { name: 'Imported name', summary, description: summary, kind: 'client' },
    ['name', 'summary'],
  );
  assert.equal(result.listing.name, 'My own name');
  assert.equal(result.listing.summary, '');
  assert.equal(result.listing.kind, 'server');
  assert.equal(result.listing.description, summary);
  assert.deepEqual(result.preserved, ['name', 'summary']);
  assert.deepEqual(result.applied, ['description']);
});
await test('discovery stays within request/concurrency budgets and preserves primary project identity', async () => {
  let requests = 0,
    active = 0,
    peak = 0;
  const seen: string[] = [];
  const read = async (url: string, limit?: number, deadline?: number) => {
    requests++;
    active++;
    peak = Math.max(peak, active);
    seen.push(url);
    assert.equal(limit, requests === 1 ? 524288 : 98304);
    assert.ok(deadline! > Date.now());
    await new Promise((r) => setTimeout(r, 2));
    active--;
    if (url === home)
      return {
        url,
        status: 200,
        contentType: 'text/html',
        text: `<title>Project</title><meta name="description" content="${summary}"><a href="https://github.com/facebook/react">Built with React</a><a href="/docs">Docs</a><a href="https://foreign.example/agentic.json">Example profile</a>`,
      };
    if (url.endsWith('/docs'))
      return {
        url,
        status: 200,
        contentType: 'text/html',
        text: '<title>Other docs title</title><p>' + summary.repeat(4) + '</p>',
      };
    return { url, status: 404, contentType: 'text/plain', text: 'missing' };
  };
  const result = await importProject(home, 'product', 'homepage', read);
  assert.ok(requests <= 6);
  assert.ok(peak <= 2);
  assert.equal(result.suggestions.name, 'Project');
  assert.equal(result.suggestions.description, summary);
  assert.equal(result.suggestions.repository, undefined);
  assert.equal(result.suggestions.profileUrl, undefined);
  assert.equal(
    seen.some((x) => x.includes('foreign') || x.includes('facebook')),
    false,
  );
  assert.ok(result.observations.some((x) => x.status === 'unavailable'));
  assert.ok(result.missing.includes('setup instructions'));
});
await test('endpoint discovery suggests a readable homepage and tolerates authentication-required endpoints', async () => {
  const read = async (url: string) => ({
    url,
    status: url === home ? 200 : 401,
    contentType: 'text/html',
    text:
      url === home
        ? `<title>Project</title><meta name="description" content="${summary}">`
        : '',
  });
  const result = await importProject(home + 'mcp', 'server', 'endpoint', read);
  assert.equal(result.suggestions.endpoint, home + 'mcp');
  assert.equal(result.suggestions.homepage, home);
  assert.equal(result.suggestions.name, 'Project');
  assert.ok(!result.missing.includes('homepage'));
});
await test('GitHub importer tolerates malformed optional metadata and enriches from README', async () => {
  const repo = 'https://api.github.com/repos/owner/project';
  const read = async (url: string) => ({
    url,
    status: 200,
    contentType: 'application/json',
    text: JSON.stringify(
      url === repo
        ? {
            name: 'Project',
            description: summary,
            topics: { bad: true },
            license: { spdx_id: null },
          }
        : {
            encoding: 'base64',
            content: Buffer.from(
              '# Project\n\n' +
                summary +
                '\n\n## Installation\n\nUse the published package.',
            ).toString('base64'),
            download_url:
              'https://raw.githubusercontent.com/owner/project/main/README.md',
          },
    ),
  });
  const result = await importProject(
    'https://github.com/owner/project',
    'server',
    'repository',
    read,
  );
  assert.equal(result.suggestions.name, 'Project');
  assert.match(result.suggestions.setup!, /published package/);
  assert.equal(result.suggestions.tags, undefined);
});
