import test from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicateGroups,
  findDuplicates,
  pairKey,
  projectKeys,
  repositoryKey,
  type DuplicateCandidate,
} from '../lib/duplicates.ts';

const imported: DuplicateCandidate = {
  slug: 'github-mcp',
  name: 'GitHub MCP Server',
  homepage: 'https://github.com/github/github-mcp-server',
  repository: 'https://github.com/github/github-mcp-server',
  source: 'Official MCP Registry',
};
const verifiedOwner: DuplicateCandidate = {
  slug: 'acme-mcp-abc123',
  name: 'Acme MCP',
  homepage: 'https://www.acme.dev/',
  repository: 'https://github.com/Acme/acme-mcp.git',
  source: 'User submission',
  agenticCheckedAt: '2026-09-01T00:00:00Z',
  submitted: true,
};
const unrelated: DuplicateCandidate = {
  slug: 'other',
  name: 'Other',
  homepage: 'https://other.example',
  source: 'Publisher documentation',
};

await test('project keys ignore www, .git and trailing slashes', () => {
  assert.equal(
    repositoryKey('https://github.com/Acme/acme-mcp.git'),
    'https://github.com/acme/acme-mcp',
  );
  assert.equal(repositoryKey('https://github.com/acme'), null);
  assert.equal(repositoryKey(''), null);
  const keys = projectKeys(verifiedOwner);
  assert.deepEqual(
    [...keys.entries()],
    [
      ['https://acme.dev', 'homepage'],
      ['https://github.com/acme/acme-mcp', 'repository'],
    ],
  );
  assert.equal(projectKeys({ homepage: 'not a url' }).size, 0);
});

await test('a submission matches an import through its homepage or repository', () => {
  const byHomepage = findDuplicates(
    { homepage: 'https://github.com/GitHub/github-mcp-server/' },
    [imported, unrelated],
  );
  assert.equal(byHomepage.length, 1);
  assert.equal(byHomepage[0]!.slug, 'github-mcp');
  assert.equal(byHomepage[0]!.reason, 'homepage');
  assert.equal(byHomepage[0]!.submitted, false);
  const byRepo = findDuplicates(
    {
      homepage: 'https://mcp.acme.dev',
      repository: 'https://github.com/acme/acme-mcp',
    },
    [imported, verifiedOwner],
  );
  assert.equal(byRepo.length, 1);
  assert.equal(byRepo[0]!.slug, 'acme-mcp-abc123');
  assert.equal(byRepo[0]!.reason, 'repository');
  assert.equal(byRepo[0]!.verified, true);
  assert.equal(byRepo[0]!.submitted, true);
  assert.deepEqual(
    findDuplicates({ homepage: 'https://acme.dev' }, [verifiedOwner], 'acme-mcp-abc123'),
    [],
  );
  assert.deepEqual(findDuplicates({ homepage: 'https://nobody.example' }, [imported]), []);
});

await test('groups collect every listing sharing a key, once', () => {
  const twin: DuplicateCandidate = {
    ...imported,
    slug: 'github-mcp-server-paid',
    name: 'GitHub MCP Server (paid)',
    homepage: 'https://www.github.com/github/github-mcp-server',
    source: 'User submission',
    submitted: true,
  };
  const groups = duplicateGroups([imported, twin, verifiedOwner, unrelated]);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0]!.items.map((i) => i.slug).sort(),
    ['github-mcp', 'github-mcp-server-paid'],
  );
  assert.equal(pairKey('b', 'a'), 'a|b');
});
