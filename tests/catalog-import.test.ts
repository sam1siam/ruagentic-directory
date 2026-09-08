import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareCatalog } from '../lib/catalog-import.ts';

const catalog = JSON.parse(
  await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'),
);
await test('every source-labeled catalog entry can be seeded without inventing ownership or adoption', () => {
  const now = '2026-09-08T00:00:00.000Z';
  const entries = prepareCatalog(catalog, now);
  assert.equal(entries.length, catalog.length);
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.equal(entry.data.publishedAt, now);
    assert.equal(entry.data.imported, true);
    assert.equal(entry.data.submitted, false);
    assert.equal(entry.data.ownershipVerified, false);
    assert.ok(entry.data.sourceUrl.startsWith('https://'));
    assert.equal('agenticCheckedAt' in entry.data, false);
  }
});

await test('import rejects malformed evidence, forged flags and duplicate slugs before returning any writes', () => {
  for (const patch of [
    { ownershipVerified: true },
    { submitted: true },
    { imported: false },
    { sourceUrl: 'http://example.com' },
    { observedAt: 'yesterday' },
    { slug: '../escape' },
    { agenticCheckedAt: '2026-09-08T00:00:00Z' },
  ])
    assert.throws(() => prepareCatalog([{ ...catalog[0], ...patch }]));
  assert.throws(
    () => prepareCatalog([catalog[0], catalog[0]]),
    /Duplicate imported slug/,
  );
});
