import DirectoryBrowser from '@/components/directory-browser';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsors } from '@/lib/advertising';
import { kindBySlug } from '@/lib/categories';
import { filtersFromParams, toBrowserListing } from '@/lib/browse';
import { browserMetrics } from '@/lib/server/metrics';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
export function kindMetadata(slug: string) {
  const page = kindBySlug(slug)!;
  return {
    title: page.name,
    description: page.description,
    alternates: { canonical: '/' + slug },
  };
}
/** Shared server component behind every kind page (/servers, /skills, /plugins and so on). */
export default async function KindPage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = kindBySlug(slug)!;
  const [params, items, sponsors, metrics] = await Promise.all([
    searchParams,
    catalog(),
    activeSponsors(),
    browserMetrics(),
  ]);
  const ofKind = items.filter((i) => i.kind === page.kind);
  const listings = ofKind.map((i) => toBrowserListing(i, metrics.get(i.slug)));
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'RUAGENTIC', path: '/' },
            { name: page.name, path: '/' + page.slug },
          ]),
          itemListJsonLd(page.name, ofKind),
        ]}
      />
      <DirectoryBrowser
        key={JSON.stringify(params)}
        listings={listings}
        lock={{ kind: page.kind }}
        initial={filtersFromParams(params)}
        sponsors={pickSponsors('listing', sponsors)}
        heading={{
          title: page.name + '.',
          lead: page.description,
          count: listings.length,
        }}
      />
    </>
  );
}
