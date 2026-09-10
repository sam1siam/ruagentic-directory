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
    ...(item.agentCard
      ? [
          property(
            item.agentProtocol === 'a2a' ? 'Agent card' : 'Agent endpoint',
            item.agentCard,
          ),
          ...(item.agentProtocol
            ? [property('Agent protocol', item.agentProtocol)]
            : []),
        ]
      : []),
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

const site = 'https://ruagentic.com';

/** The site itself, with the search box's query parameter. */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': site + '/#website',
    name: 'RUAGENTIC',
    url: site + '/',
    description:
      'The official Agentic Protocol directory of MCP servers, clients and AI agents.',
    publisher: { '@id': site + '/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: site + '/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** The organisation behind the directory; only public, verifiable links. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': site + '/#organization',
    name: 'RUAGENTIC',
    url: site + '/',
    logo: site + '/icon-512.png',
    sameAs: ['https://github.com/ruagentic', 'https://ruagentic.org/'],
  };
}

/** Breadcrumb trail; the last item is the current page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: site + item.path,
    })),
  };
}

/** An ordered list of listing pages, capped so the block stays small. */
export function itemListJsonLd(
  name: string,
  items: { name: string; slug: string }[],
  limit = 50,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.slice(0, limit).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: site + '/tools/' + item.slug,
    })),
  };
}
