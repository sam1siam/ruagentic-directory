import test from 'node:test';
import assert from 'node:assert/strict';
import { faqJsonLd, listingFaq } from '../lib/faq.ts';
import { emptyListing, type PublicListing } from '../lib/listing.ts';

const base: PublicListing = {
  ...emptyListing,
  kind: 'server',
  name: 'Example MCP',
  summary: 'Search public project documentation through MCP.',
  description:
    'An MCP server that searches public project documentation and returns source links.',
  homepage: 'https://example.com',
  repository: 'https://github.com/example/project',
  category: 'Search & research',
  pricing: 'open-source',
  authentication: 'api-key',
  capabilities: ['Search docs', 'Return source links'],
  platforms: [],
  slug: 'example-mcp',
  source: 'Publisher repository',
  sourceUrl: 'https://github.com/example/project',
  observedAt: '2026-09-08',
  publishedAt: '',
};

void test('A server listing answers what, how, auth, price, capabilities and provenance', () => {
  const faq = listingFaq(base);
  assert.deepEqual(
    faq.map((f) => f.q),
    [
      'What is Example MCP?',
      'How do I connect to Example MCP?',
      'Does Example MCP need authentication?',
      'Is Example MCP free?',
      'What can Example MCP do?',
      'Where is Example MCP published?',
    ],
  );
  assert.match(
    faq[0]!.a,
    /^Example MCP is an MCP server in the Search & research category\./,
  );
  assert.match(
    faq[1]!.a,
    /source repository, https:\/\/github\.com\/example\/project/,
  );
  assert.match(faq[2]!.a, /API key issued by the publisher/);
  assert.match(faq[3]!.a, /Open source/);
  assert.match(faq[4]!.a, /Search docs; Return source links/);
  assert.match(
    faq[5]!.a,
    /read these details from Publisher repository on September 8, 2026/,
  );
});
void test('Unknown facts are left out instead of guessed, and packaged kinds get install answers', () => {
  const skill = listingFaq({
    ...base,
    kind: 'skill',
    pricing: 'unknown',
    authentication: 'not-applicable',
    capabilities: [],
    platforms: ['Claude Code'],
    fileUrl: 'https://github.com/example/project/blob/main/SKILL.md',
  });
  assert.deepEqual(
    skill.map((f) => f.q),
    [
      'What is Example MCP?',
      'How do I install Example MCP?',
      'Which agents or platforms work with Example MCP?',
      'Where is Example MCP published?',
    ],
  );
  assert.match(skill[0]!.a, /is a skill in the/);
  assert.match(skill[1]!.a, /SKILL\.md/);
  assert.match(skill[2]!.a, /Claude Code/);
});
void test('FAQ structured data mirrors the visible questions', () => {
  const ld = faqJsonLd([{ q: 'Q?', a: 'A.' }]);
  assert.equal(ld['@type'], 'FAQPage');
  assert.deepEqual(ld.mainEntity, [
    {
      '@type': 'Question',
      name: 'Q?',
      acceptedAnswer: { '@type': 'Answer', text: 'A.' },
    },
  ]);
});
