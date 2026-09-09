import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryExtraAmount,
  creativeMetadata,
  creativeSchema,
  houseSponsor,
  isAdMetadata,
  parseCategories,
  pickSponsor,
  placementSurfaces,
  placements,
  quote,
  sponsorHref,
  sponsorSlug,
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

await test('one category is included and each extra adds US$50', () => {
  assert.equal(categoryExtraAmount, 5000);
  assert.deepEqual(quote('card', ['finance']), {
    amount: 49900,
    extras: 0,
    display: 'US$499',
  });
  assert.deepEqual(quote('card', ['finance', 'automation', 'productivity']), {
    amount: 59900,
    extras: 2,
    display: 'US$599',
  });
  assert.deepEqual(quote('both', ['finance', 'automation']), {
    amount: 134900,
    extras: 1,
    display: 'US$1,349',
  });
  assert.equal(quote('bar', ['finance', 'automation']).extras, 0);
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
  assert.equal(metadata.categories, '');
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
    categories: ['finance', 'automation'],
  });
  assert.equal(creativeMetadata(withCard).cta, 'Start free');
  assert.equal(creativeMetadata(withCard).categories, 'finance,automation');
  assert.deepEqual(parseCategories('finance, nope,automation'), [
    'finance',
    'automation',
  ]);
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
    // Card placements need a description and at least one category.
    {
      placement: 'card',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      categories: ['finance'],
    },
    {
      placement: 'card',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      description: 'A long enough description for the card.',
    },
    {
      placement: 'card',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      description: 'A long enough description for the card.',
      categories: ['not-a-category'],
    },
    {
      placement: 'card',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      description: 'A long enough description for the card.',
      categories: ['finance', 'finance'],
    },
    {
      placement: 'both',
      product: 'Ok',
      tagline: 'long enough tagline',
      url: 'https://example.com',
      description: 'too short',
      categories: ['finance'],
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
  assert.equal(
    sponsorSlug('Acme AI!', 'cs_test_a1B2c3D4E5F6'),
    'acme-ai-d4e5f6',
  );
  assert.equal(sponsorSlug('!!!', 'cs_x'), 'sponsor-csx');
});

await test('slots prefer paid sponsors, respect categories, and fall back to the house sponsor', () => {
  const paid = (
    name: string,
    placement: Sponsor['placement'],
    categories: string[] = [],
  ): Sponsor => ({
    name,
    tagline: 'Tagline for ' + name,
    url: 'https://' + name.toLowerCase() + '.example',
    page: '/sponsors/' + name.toLowerCase(),
    placement,
    categories,
  });
  const all = [
    paid('Alpha', 'both', ['finance']),
    paid('Beta', 'card', ['automation', 'finance']),
    houseSponsor,
  ];
  assert.equal(pickSponsor('bar', all, 0)?.name, 'Alpha');
  assert.equal(pickSponsor('bar', all, 600000)?.name, 'Alpha');
  assert.equal(pickSponsor('listing', all, 0)?.name, 'Alpha');
  assert.equal(pickSponsor('listing', all, 600000)?.name, 'Beta');
  assert.equal(pickSponsor('listing', all, 0, 'automation')?.name, 'Beta');
  assert.equal(pickSponsor('listing', all, 600000, 'automation')?.name, 'Beta');
  assert.equal(pickSponsor('detail', all, 600000, 'finance')?.name, 'Beta');
  assert.equal(
    pickSponsor('listing', all, 0, 'productivity')?.name,
    'AstroFabric',
    'house sponsor covers categories nobody bought',
  );
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
  assert.equal(houseSponsor.page, '/tools/astrofabric');
  assert.ok(houseSponsor.description && houseSponsor.description.length >= 20);
});

await test('category billing plan matches the chosen categories', async () => {
  const { categoryItemPlan, creativeEditSchema } =
    await import('../lib/advertising.ts');
  assert.deepEqual(categoryItemPlan(null, ['finance']), {
    action: 'none',
    quantity: 0,
  });
  assert.deepEqual(categoryItemPlan(null, ['finance', 'automation']), {
    action: 'create',
    quantity: 1,
  });
  assert.deepEqual(categoryItemPlan(1, ['finance', 'automation']), {
    action: 'none',
    quantity: 1,
  });
  assert.deepEqual(
    categoryItemPlan(1, ['finance', 'automation', 'productivity']),
    { action: 'update', quantity: 2 },
  );
  assert.deepEqual(categoryItemPlan(2, ['finance']), {
    action: 'delete',
    quantity: 0,
  });
  const edit = creativeEditSchema('card').parse({
    tagline: 'A tagline long enough to pass.',
    description: 'A description long enough for the featured card.',
    cta: 'Try it',
    categories: ['finance', 'automation'],
  });
  assert.equal(edit.categories.length, 2);
  const barEdit = creativeEditSchema('bar').parse({
    tagline: 'A tagline long enough to pass.',
    description: 'ignored for the bar',
    categories: ['finance'],
  });
  assert.deepEqual(barEdit, {
    tagline: 'A tagline long enough to pass.',
    description: '',
    cta: '',
    categories: [],
  });
  assert.ok(
    !creativeEditSchema('card').safeParse({
      tagline: 'A tagline long enough to pass.',
      description: 'short',
      categories: ['finance'],
    }).success,
  );
  assert.ok(
    !creativeEditSchema('card').safeParse({
      tagline: 'A tagline long enough to pass.',
      description: 'A description long enough for the featured card.',
      categories: [],
    }).success,
  );
});
