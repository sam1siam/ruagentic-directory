import test from 'node:test';
import assert from 'node:assert/strict';
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '../lib/seo.ts';

await test('website and organisation blocks link to each other', () => {
  const site = websiteJsonLd();
  const org = organizationJsonLd();
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.publisher['@id'], org['@id']);
  assert.match(
    site.potentialAction.target.urlTemplate,
    /\?q=\{search_term_string\}$/,
  );
  assert.deepEqual(org.sameAs, [
    'https://github.com/ruagentic',
    'https://ruagentic.org/',
  ]);
  assert.equal(org.logo, 'https://ruagentic.com/icon-512.png');
});

await test('breadcrumbs and item lists use absolute urls and positions', () => {
  const crumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'MCP servers', path: '/servers' },
    { name: 'GitHub MCP Server', path: '/tools/github-mcp' },
  ]);
  assert.equal(crumbs.itemListElement.length, 3);
  assert.equal(crumbs.itemListElement[2]!.position, 3);
  assert.equal(
    crumbs.itemListElement[2]!.item,
    'https://ruagentic.com/tools/github-mcp',
  );
  const items = Array.from({ length: 60 }, (_, i) => ({
    name: 'Tool ' + i,
    slug: 'tool-' + i,
  }));
  const list = itemListJsonLd('Developer tools', items);
  assert.equal(list.numberOfItems, 60);
  assert.equal(list.itemListElement.length, 50);
  assert.equal(
    list.itemListElement[0]!.url,
    'https://ruagentic.com/tools/tool-0',
  );
});
