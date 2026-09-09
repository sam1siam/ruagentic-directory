import DirectoryBrowser from '@/components/directory-browser';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsor } from '@/lib/advertising';
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
  return (
    <DirectoryBrowser
      key={JSON.stringify(params)}
      mode="home"
      listings={items.map(toBrowserListing)}
      initial={params}
      sponsor={pickSponsor('listing', sponsors)}
    />
  );
}
