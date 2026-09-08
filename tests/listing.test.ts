import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanUrl,
  emptyListing,
  listingSchema,
  profileLocation,
  publicationEligible,
  safeNext,
  serviceIdentity,
} from '../lib/listing.ts';

await test('public listing URLs normalize HTTPS without retaining secrets or unsafe destinations', () => {
  assert.equal(
    cleanUrl('  EXAMPLE.com:443/docs  '),
    'https://example.com/docs',
  );
  assert.equal(cleanUrl('https://8.8.8.8/'), 'https://8.8.8.8/');
  assert.equal(
    cleanUrl('https://[2001:4860:4860::8888]/'),
    'https://[2001:4860:4860::8888]/',
  );
  assert.equal(cleanUrl('  '), '');
  const rejected = [
    'http://example.com',
    'https://name:secret@example.com',
    'https://example.com?token=secret',
    'https://example.com#secret',
    'https://example.com:8443',
    'https://localhost',
    'https://api.localhost',
    'https://service.local',
    'https://intranet',
    'https://127.0.0.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://0177.0.0.1',
    'https://10.0.0.1',
    'https://172.16.0.1',
    'https://192.168.1.1',
    'https://169.254.169.254',
    'https://100.64.0.1',
    'https://[::1]',
    'https://[fc00::1]',
    'https://[fe80::1]',
    'https://[::ffff:127.0.0.1]',
    'https://example.com/' + 'a'.repeat(2048),
  ];
  for (const url of rejected) assert.throws(() => cleanUrl(url), url);
});

const listing = {
  ...emptyListing,
  name: 'Example MCP',
  summary: 'Search public project documentation through MCP.',
  description:
    'An MCP server that searches public project documentation and returns source links with each result.',
  homepage: 'https://example.com',
  repository: 'https://github.com/example/project',
};

await test('listing input requires a real server location and rejects client-supplied publication flags', () => {
  assert.equal(listingSchema.safeParse(listing).success, true);
  assert.equal(
    listingSchema.safeParse({
      ...listing,
      repository: '',
      endpoint: 'https://example.com/mcp',
    }).success,
    true,
  );
  assert.equal(
    listingSchema.safeParse({ ...listing, repository: '', endpoint: '' })
      .success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({ ...listing, homepage: '' }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({ ...listing, homepage: 'https://127.0.0.1' })
      .success,
    false,
  );
  for (const field of [
    'ownershipVerified',
    'agenticCheckedAt',
    'publishedAt',
    'eligible',
    'source',
  ]) {
    assert.equal(
      listingSchema.safeParse({ ...listing, [field]: true }).success,
      false,
      field,
    );
  }
});

await test('free verification binds to a website origin and resolves a supplied directory to agentic.json', () => {
  assert.equal(
    profileLocation({ homepage: 'https://example.com/docs', profileUrl: '' }),
    'https://example.com/agentic.json',
  );
  assert.equal(
    profileLocation({
      homepage: 'https://example.com',
      profileUrl: 'https://example.com/profiles/',
    }),
    'https://example.com/profiles/agentic.json',
  );
  assert.equal(
    profileLocation({
      homepage: 'https://example.com',
      profileUrl: 'https://example.com/profiles/agentic.json',
    }),
    'https://example.com/profiles/agentic.json',
  );
  for (const profileUrl of [
    'https://other.example/agentic.json',
    'https://sub.example.com/agentic.json',
    'http://example.com/agentic.json',
  ]) {
    assert.throws(
      () => profileLocation({ homepage: 'https://example.com', profileUrl }),
      profileUrl,
    );
  }
  for (const homepage of [
    'https://github.com/example/project',
    'https://raw.githubusercontent.com/example/project/main',
    'https://npmjs.com/package/example',
    'https://www.npmjs.com/package/example',
    'https://pypi.org/project/example',
  ]) {
    assert.throws(
      () => profileLocation({ homepage, profileUrl: '' }),
      /project website/,
      homepage,
    );
  }
});

await test('service identities group website pages but keep distinct GitHub repositories separate', () => {
  assert.equal(
    serviceIdentity({ homepage: 'https://example.com/docs' }),
    serviceIdentity({ homepage: 'https://example.com/product' }),
  );
  assert.equal(
    serviceIdentity({ homepage: 'https://github.com/Owner/Project/' }),
    'https://github.com/owner/project',
  );
  assert.notEqual(
    serviceIdentity({ homepage: 'https://github.com/owner/first' }),
    serviceIdentity({ homepage: 'https://github.com/owner/second' }),
  );
});

await test('post-login destinations cannot leave the site', () => {
  for (const value of [
    '/submit',
    '/submit?edit=123',
    '/dashboard',
    '/reset-password',
  ])
    assert.equal(safeNext(value), value);
  for (const value of [
    null,
    '',
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '/dashboard\\attacker.example',
    '/administrator',
    '/dashboardevil',
  ]) {
    assert.equal(safeNext(value), '/dashboard', String(value));
  }
});

await test('free publication requires a complete report for this exact profile, never a partial or older audit', () => {
  const profileUrl = 'https://example.com/agentic.json';
  const valid = {
    reportVersion: '3',
    valid: true,
    profileUrl,
    publication: { status: 'successful' },
    textIndex: { status: 'matched' },
    readme: { status: 'matched' },
  };
  assert.equal(publicationEligible(valid, profileUrl), true);
  const rejected: unknown[] = [
    null,
    undefined,
    {},
    true,
    { valid: true },
    { ...valid, reportVersion: '2' },
    { ...valid, reportVersion: 3 },
    { ...valid, valid: false },
    { ...valid, valid: 'true' },
    { ...valid, profileUrl: 'https://other.example/agentic.json' },
    { ...valid, profileUrl: profileUrl + '?claimed=true' },
    { ...valid, publication: { status: 'partial' } },
    { ...valid, publication: { status: 'failed' } },
    { ...valid, publication: undefined },
    { ...valid, textIndex: { status: 'missing' } },
    { ...valid, textIndex: { status: 'mismatched' } },
    { ...valid, textIndex: undefined },
    { ...valid, readme: { status: 'missing' } },
    { ...valid, readme: { status: 'mismatched' } },
    { ...valid, readme: undefined },
  ];
  for (const report of rejected)
    assert.equal(
      publicationEligible(report, profileUrl),
      false,
      JSON.stringify(report),
    );
});
