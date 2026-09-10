import DirectoryBrowser from '@/components/directory-browser';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsors } from '@/lib/advertising';
import { kindBySlug } from '@/lib/categories';
import { toBrowserListing } from '@/lib/browse';
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
/** Shared server component behind /servers, /clients and /ai-agents. */
export default async function KindPage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const page = kindBySlug(slug)!;
  const [params, items, sponsors] = await Promise.all([
    searchParams,
    catalog(),
    activeSponsors(),
  ]);
  const ofKind = items.filter((i) => i.kind === page.kind);
  const listings = ofKind.map(toBrowserListing);
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
        initial={params}
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
