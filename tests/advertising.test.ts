import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creativeMetadata,
  creativeSchema,
  houseSponsor,
  isAdMetadata,
  pickSponsor,
  tierSurfaces,
  tiers,
} from '../lib/advertising.ts';

await test('sponsor tiers mirror the published placements and prices', () => {
  assert.deepEqual(
    tiers.map((t) => [t.id, t.amount, t.surfaces.length]),
    [
      ['platinum', 129900, 3],
      ['gold', 69900, 2],
      ['silver', 39900, 1],
    ],
  );
  assert.ok(tiers.every((t) => tierSurfaces(t).includes('detail')));
  assert.equal(tiers.filter((t) => tierSurfaces(t).includes('bar')).length, 1);
});

await test('creatives are validated and fit Stripe metadata limits', () => {
  const creative = creativeSchema.parse({
    tier: 'gold',
    product: 'Example',
    tagline: 'One sentence that makes developers click.',
    url: 'https://example.com/?ref=ruagentic',
  });
  const metadata = creativeMetadata(creative);
  assert.equal(metadata.app, 'ruagentic-ads');
  assert.ok(Object.values(metadata).every((v) => v.length <= 500));
  assert.ok(isAdMetadata(metadata));
  assert.ok(!isAdMetadata({ app: 'ruagentic-directory' }));
  for (const bad of [
    {
      tier: 'bronze',
      product: 'X',
      tagline: 'long enough tagline',
      url: 'https://a.b',
    },
    {
      tier: 'gold',
      product: 'X',
      tagline: 'long enough tagline',
      url: 'http://insecure.example',
    },
    {
      tier: 'gold',
      product: 'X',
      tagline: 'long enough tagline',
      url: 'https://user:pw@example.com',
    },
    {
      tier: 'gold',
      product: 'Ok',
      tagline: 'short',
      url: 'https://example.com',
    },
  ])
    assert.equal(
      creativeSchema.safeParse(bad).success,
      false,
      JSON.stringify(bad),
    );
});

await test('sponsor selection prefers the highest tier and rotates within it', () => {
  const sponsors = [
    {
      name: 'S1',
      tagline: 't',
      url: 'https://s1.example',
      tier: 'silver' as const,
    },
    {
      name: 'G1',
      tagline: 't',
      url: 'https://g1.example',
      tier: 'gold' as const,
    },
    {
      name: 'G2',
      tagline: 't',
      url: 'https://g2.example',
      tier: 'gold' as const,
    },
  ];
  assert.equal(pickSponsor('bar', sponsors), null);
  assert.equal(
    pickSponsor('bar', [...sponsors, houseSponsor])?.name,
    'AstroFabric',
  );
  const slotA = pickSponsor('listing', sponsors, 0)?.name;
  const slotB = pickSponsor('listing', sponsors, 600000)?.name;
  assert.deepEqual(new Set([slotA, slotB]), new Set(['G1', 'G2']));
  assert.equal(pickSponsor('detail', [sponsors[0]])?.name, 'S1');
});
