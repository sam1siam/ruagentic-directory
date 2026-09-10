import test from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeLabel,
  badgeSnippets,
  badgeSvg,
  cardSvg,
  embedHtml,
  isVerified,
  wrapLines,
  type BadgeItem,
} from '../lib/badge.ts';

const listed: BadgeItem = {
  slug: 'exa-mcp',
  name: 'Exa MCP',
  kind: 'server',
  category: 'Search & research',
  summary:
    'Provide web search, crawling and coding context to MCP clients through one remote endpoint with API-key authentication.',
};
const verified: BadgeItem = {
  ...listed,
  slug: 'helper-agent',
  name: 'Helper <Agent> & Co',
  kind: 'product',
  agenticCheckedAt: '2026-09-08T10:00:00.000Z',
};

await test('verified wording appears only with a publication check date', () => {
  assert.equal(isVerified(listed), false);
  assert.equal(isVerified(verified), true);
  assert.equal(badgeLabel(false), 'Listed on RUAGENTIC');
  assert.equal(
    badgeLabel(true),
    'Agentic Protocol verified · Listed on RUAGENTIC',
  );
  assert.doesNotMatch(badgeSvg(false), /VERIFIED/);
  assert.match(badgeSvg(true), /AGENTIC PROTOCOL VERIFIED/);
  assert.match(badgeSvg(true), /LISTED ON RUAGENTIC/);
});

await test('badge is a self-contained svg with a stable height', () => {
  for (const svg of [badgeSvg(false), badgeSvg(true)]) {
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.match(svg, /height="28"/);
    assert.match(svg, /<title>/);
    assert.doesNotMatch(svg, /<script|href=/);
  }
  const short = Number(badgeSvg(false).match(/width="(\d+)"/)![1]);
  const long = Number(badgeSvg(true).match(/width="(\d+)"/)![1]);
  assert.ok(long > short + 100);
});

await test('wrapLines keeps to the line budget and marks truncation', () => {
  assert.deepEqual(wrapLines('one two three', 20, 2), ['one two three']);
  const lines = wrapLines(listed.summary, 30, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => l.length <= 30));
  assert.ok(lines[1]!.endsWith('…'));
  assert.deepEqual(wrapLines('', 30, 2), []);
});

await test('card and embed escape listing text and link to the listing', () => {
  const card = cardSvg(verified);
  assert.match(card, /width="480" height="150"/);
  assert.match(card, /Helper &lt;Agent&gt; &amp; Co/);
  assert.doesNotMatch(card, /<Agent>/);
  assert.match(card, /AI AGENT/);
  assert.match(card, /AGENTIC PROTOCOL VERIFIED/);
  assert.match(card, /ruagentic\.com\/tools\/helper-agent/);
  assert.doesNotMatch(cardSvg(listed), /VERIFIED/);
  assert.match(cardSvg(listed), /MCP SERVER/);
  // A long slug is shortened so the url never runs into the status pill.
  const long = cardSvg({
    ...verified,
    slug: 'a-very-long-listing-slug-that-keeps-going-and-going-forever',
  });
  const urlLength = Number(
    long.match(/<text x="20" y="137" textLength="(\d+)"/)![1],
  );
  const statusX = Number(long.match(/<rect x="(\d+)" y="126"/)![1]);
  assert.ok(urlLength + 20 < statusX, 'url overlaps the status pill');
  assert.match(long, /…<\/text>/);
  const html = embedHtml(verified);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(
    html,
    /href="https:\/\/ruagentic\.com\/tools\/helper-agent" target="_top"/,
  );
  assert.match(html, /Helper &lt;Agent&gt; &amp; Co/);
  assert.match(html, /Agentic Protocol verified/);
  assert.match(embedHtml(listed), /Listed on RUAGENTIC/);
});

await test('snippets point at the badge, card, iframe and listing urls', () => {
  const s = badgeSnippets(verified);
  assert.equal(
    s.markdownBadge,
    '[![Agentic Protocol verified · Listed on RUAGENTIC](https://ruagentic.com/badge/helper-agent.svg)](https://ruagentic.com/tools/helper-agent)',
  );
  assert.match(
    s.htmlBadge,
    /<img src="https:\/\/ruagentic\.com\/badge\/helper-agent\.svg"/,
  );
  assert.match(
    s.htmlBadge,
    /alt="Agentic Protocol verified · Listed on RUAGENTIC"/,
  );
  assert.match(s.markdownCard, /embed\/helper-agent\.svg/);
  assert.match(
    s.htmlEmbed,
    /<iframe src="https:\/\/ruagentic\.com\/embed\/helper-agent" width="480" height="150"/,
  );
  assert.match(
    s.htmlEmbed,
    /title="Helper &lt;Agent&gt; &amp; Co on RUAGENTIC"/,
  );
  assert.match(
    badgeSnippets(listed).markdownBadge,
    /^\[!\[Listed on RUAGENTIC\]/,
  );
});
