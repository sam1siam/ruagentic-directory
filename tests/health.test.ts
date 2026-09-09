import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, STALE_DAYS } from '../lib/health-policy.ts';

const day = 86400000;
await test('healthy listings report ok; bot walls and MCP handshakes are not failures', () => {
  const result = classify({
    links: {
      homepage: { url: 'https://a.example', status: 403 },
      documentation: { url: 'https://a.example/docs', status: 429 },
      repository: { url: 'https://github.com/a/b', status: 200 },
      endpoint: { url: 'https://a.example/mcp', status: 405 },
    },
    repo: { found: true, archived: false, pushedAt: new Date().toISOString() },
    registry: { name: 'io.github.a/b', found: true, version: '1.2.3' },
    knownVersion: '1.2.3',
  });
  assert.deepEqual(result, { status: 'ok', issues: [] });
});

await test('dead homepage or repository is broken; docs, staleness and registry drift only warn', () => {
  const broken = classify({
    links: {
      homepage: { url: 'https://a.example', status: 404 },
      repository: { url: 'https://github.com/a/b', status: 200 },
    },
    repo: { found: true, archived: false, pushedAt: new Date().toISOString() },
  });
  assert.equal(broken.status, 'broken');
  assert.equal(broken.issues[0].code, 'homepage');
  const gone = classify({ links: {}, repo: { found: false } });
  assert.equal(gone.status, 'broken');
  assert.equal(gone.issues[0].code, 'repo-missing');
  const warn = classify({
    links: {
      homepage: { url: 'https://a.example', status: 200 },
      documentation: { url: 'https://a.example/docs', status: 0 },
    },
    repo: {
      found: true,
      archived: true,
      pushedAt: new Date(Date.now() - (STALE_DAYS + 10) * day).toISOString(),
      renamedTo: 'https://github.com/c/d',
    },
    registry: { name: 'io.github.a/b', found: true, version: '2.0.0' },
    knownVersion: '1.0.0',
  });
  assert.equal(warn.status, 'warn');
  assert.deepEqual(
    warn.issues.map((i) => i.code),
    [
      'documentation',
      'repo-archived',
      'repo-renamed',
      'repo-stale',
      'registry-updated',
    ],
  );
  const missing = classify({
    links: {},
    registry: { name: 'io.github.a/b', found: false },
  });
  assert.equal(missing.status, 'warn');
  assert.equal(missing.issues[0].code, 'registry-missing');
});
