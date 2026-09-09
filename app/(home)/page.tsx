import DirectoryBrowser from '@/components/directory-browser';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsor, type Sponsor } from '@/lib/advertising';
import { categories } from '@/lib/categories';
import { toBrowserListing } from '@/lib/browse';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; category?: string }>;
}) {
  const [params, items, sponsors] = await Promise.all([
    searchParams,
    catalog(),
    activeSponsors(),
  ]);
  // Category sections only carry cards from sponsors who bought that category.
  const paid = sponsors.filter((s) => !s.house);
  const categorySponsors: Record<string, Sponsor> = {};
  for (const c of categories) {
    const s = pickSponsor('listing', paid, undefined, c.slug);
    if (s) categorySponsors[c.slug] = s;
  }
  return (
    <DirectoryBrowser
      key={JSON.stringify(params)}
      mode="home"
      listings={items.map(toBrowserListing)}
      initial={params}
      sponsor={pickSponsor('listing', sponsors)}
      categorySponsors={categorySponsors}
    />
  );
}
