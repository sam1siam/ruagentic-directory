import Catalog from '@/components/catalog';
import { catalog } from '@/lib/server/catalog';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; category?: string }>;
}) {
  return (
    <Catalog
      key={JSON.stringify(await searchParams)}
      listings={(await catalog()).map(
        ({ slug, name, kind, summary, category, homepage, tags, source }) => ({
          slug,
          name,
          kind,
          summary,
          category,
          homepage,
          tags,
          source,
        }),
      )}
      initial={await searchParams}
    />
  );
}
