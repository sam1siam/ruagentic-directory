import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creativeMetadata,
  creativeSchema,
  houseSponsor,
  isAdMetadata,
  pickSponsor,
  placementSurfaces,
  placements,
  sponsorHref,
  type Sponsor,
} from '../lib/advertising.ts';

await test('placements mirror the published options and prices', () => {
  assert.deepEqual(
    placements.map((p) => [p.id, p.amount, p.surfaces.length]),
    [
      ['bar', 99900, 1],
      ['card', 49900, 2],
      ['both', 129900, 3],
    ],
  );
  const bar = placements.find((p) => p.id === 'bar')!;
  const card = placements.find((p) => p.id === 'card')!;
  const both = placements.find((p) => p.id === 'both')!;
  assert.ok(both.amount < bar.amount + card.amount, 'bundle is discounted');
  assert.ok(placementSurfaces(bar).includes('bar'));
  assert.ok(!placementSurfaces(bar).includes('listing'));
  assert.ok(placementSurfaces(card).includes('listing'));
  assert.ok(placementSurfaces(card).includes('detail'));
  assert.ok(!placementSurfaces(card).includes('bar'));
});

await test('creatives are validated and fit Stripe metadata limits', () => {
  const creative = creativeSchema.parse({
    placement: 'bar',
    product: 'Example',
    tagline: 'One sentence that makes users click.',
    url: 'https://example.com/?ref=example',
  });
  const metadata = creativeMetadata(creative);
  assert.equal(metadata.app, 'ruagentic-ads');
  assert.equal(metadata.description, '');
  assert.ok(Object.values(metadata).every((v) => v.length <= 500));
  assert.ok(isAdMetadata(metadata));
  assert.ok(!isAdMetadata({ app: 'ruagentic-directory' }));
  const withCard = creativeSchema.parse({
    placement: 'both',
    product: 'Example',
    tagline: 'One sentence that makes users click.',
    url: 'https://example.com/',
    description: 'A longer description for the featured card and tile.',
    cta: 'Start free',
  });
  assert.equal(creativeMetadata(withCard).cta, 'Start free');
  for (const bad of [
    {
      placement: 'platinum',
      product: 'X',
      tagline: 'long enough tagline',
      url: 'https://a.b',
    },
    {
      placement: 'bar',
      product: 'X',
      tagline: 'long enough tagline',
      url: 'http://insecure.example',
    },
    {
      placement: 'bar',
      product: 'X',
      tagline: 'long enough tagline',
      url: 'https://user:pw@example.com',
    },
    {
      placement: 'bar',
      product: 'Ok',
      tagline: 'short',
      url: 'https://example.com',
    },
    // Card placements need a description.
    {
      placement: 'card',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
    },
    {
      placement: 'both',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      description: 'too short',
    },
    {
      placement: 'bar',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      extra: true,
    },
  ])
    assert.ok(!creativeSchema.safeParse(bad).success, JSON.stringify(bad));
});

await test('sponsor links carry the directory referrer without breaking the URL', () => {
  assert.equal(
    sponsorHref('https://astrofabric.ai'),
    'https://astrofabric.ai/?ref=ruagentic.com',
  );
  assert.equal(
    sponsorHref('https://example.com/launch?utm_source=x#pricing'),
    'https://example.com/launch?utm_source=x&ref=ruagentic.com#pricing',
  );
  assert.equal(
    sponsorHref('https://example.com/?ref=custom'),
    'https://example.com/?ref=custom',
  );
  assert.equal(sponsorHref('not a url'), 'not a url');
});

await test('slots prefer paid sponsors, rotate evenly, and fall back to the house sponsor', () => {
  const paid = (name: string, placement: Sponsor['placement']): Sponsor => ({
    name,
    tagline: 'Tagline for ' + name,
    url: 'https://' + name.toLowerCase() + '.example',
    placement,
  });
  const all = [paid('Alpha', 'both'), paid('Beta', 'card'), houseSponsor];
  assert.equal(pickSponsor('bar', all, 0)?.name, 'Alpha');
  assert.equal(pickSponsor('bar', all, 600000)?.name, 'Alpha');
  assert.equal(pickSponsor('listing', all, 0)?.name, 'Alpha');
  assert.equal(pickSponsor('listing', all, 600000)?.name, 'Beta');
  assert.equal(pickSponsor('detail', all, 1200000)?.name, 'Alpha');
  assert.equal(
    pickSponsor('bar', [paid('Beta', 'card'), houseSponsor])?.name,
    'AstroFabric',
  );
  assert.equal(
    pickSponsor('listing', [paid('Gamma', 'bar'), houseSponsor])?.name,
    'AstroFabric',
  );
  assert.equal(pickSponsor('detail', [houseSponsor])?.name, 'AstroFabric');
  assert.equal(pickSponsor('detail', [paid('Gamma', 'bar')]), null);
  assert.ok(houseSponsor.description && houseSponsor.description.length >= 20);
});
