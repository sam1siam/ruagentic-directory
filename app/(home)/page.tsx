import DirectoryBrowser from '@/components/directory-browser';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsors, type Sponsor } from '@/lib/advertising';
import { categories, kinds } from '@/lib/categories';
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
  // Kind sections show every card sponsor (newest first); the house card
  // fills the first section only when nobody has bought a card. Category
  // sections carry only sponsors who bought that category.
  const paid = sponsors.filter((s) => !s.house);
  const sectionSponsors: Record<string, Sponsor[]> = {};
  const cardSponsors = pickSponsors('listing', paid);
  kinds.forEach((k, index) => {
    sectionSponsors[k.slug] =
      cardSponsors.length || index > 0
        ? cardSponsors
        : pickSponsors('listing', sponsors);
  });
  for (const c of categories)
    sectionSponsors[c.slug] = pickSponsors('listing', paid, c.slug);
  return (
    <DirectoryBrowser
      key={JSON.stringify(params)}
      mode="home"
      listings={items.map(toBrowserListing)}
      initial={params}
      sectionSponsors={sectionSponsors}
    />
  );
}
