import DirectoryBrowser from '@/components/directory-browser';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsor } from '@/lib/advertising';
import { kindBySlug } from '@/lib/categories';
import { toBrowserListing } from '@/lib/browse';
export function kindMetadata(slug: string) {
  const page = kindBySlug(slug)!;
  return { title: page.name, description: page.description };
}
/** Shared server component behind /servers, /clients and /products. */
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
  const listings = items
    .filter((i) => i.kind === page.kind)
    .map(toBrowserListing);
  return (
    <DirectoryBrowser
      key={JSON.stringify(params)}
      listings={listings}
      lock={{ kind: page.kind }}
      initial={params}
      sponsor={pickSponsor(
        'listing',
        sponsors.filter((s) => !s.house),
      )}
      heading={{
        title: page.name + '.',
        lead: page.description,
        count: listings.length,
      }}
    />
  );
}
