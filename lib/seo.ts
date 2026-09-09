/** Structured data for a listing page. Only fields the catalog actually
 *  holds are emitted; there are no ratings or review counts because the
 *  directory does not collect them. */
import type { PublicListing } from './listing';
import type { Package, Remote } from './connect';

export function listingJsonLd(item: PublicListing, canonical: string) {
  const remotes = ((item.remotes ?? []) as Remote[]).filter((r) => r.url);
  const packages = ((item.packages ?? []) as Package[]).filter(
    (p) => p.identifier,
  );
  const free = item.pricing === 'free' || item.pricing === 'open-source';
  const property = (name: string, value: string) => ({
    '@type': 'PropertyValue',
    name,
    value,
  });
  const additional = [
    ...(item.endpoint ? [property('MCP endpoint', item.endpoint)] : []),
    ...remotes
      .filter((r) => r.url !== item.endpoint)
      .map((r) => property('MCP endpoint', r.url!)),
    ...(item.transport && item.transport !== 'unknown'
      ? [property('MCP transport', item.transport)]
      : []),
    ...(item.authentication && item.authentication !== 'unknown'
      ? [property('Authentication', item.authentication)]
      : []),
    ...packages.map((p) =>
      property(
        'Package',
        [p.registryType, p.identifier].filter(Boolean).join(': ') +
          (p.version ? ' @ ' + p.version : ''),
      ),
    ),
    ...(item.license ? [property('License', item.license)] : []),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: item.name,
    description: item.summary,
    url: item.homepage,
    mainEntityOfPage: canonical,
    applicationCategory: item.category,
    ...(item.platforms.length
      ? { operatingSystem: item.platforms.join(', ') }
      : {}),
    ...(free
      ? {
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
        }
      : {}),
    ...(item.repository || item.documentation
      ? {
          sameAs: [item.repository, item.documentation].filter(Boolean),
        }
      : {}),
    ...(item.capabilities.length
      ? { featureList: item.capabilities.join(', ') }
      : {}),
    ...(additional.length ? { additionalProperty: additional } : {}),
  };
}
