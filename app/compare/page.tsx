import Compare from '@/components/compare';
import { catalog } from '@/lib/server/catalog';
export const metadata = {
  title: 'Compare tools',
  description:
    'Compare MCP servers, clients and AI agents side by side: transport, authentication, pricing, platforms and checked files.',
  robots: { index: false, follow: true },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tools?: string }>;
}) {
  const p = await searchParams;
  return (
    <main className="content-page">
      <div className="page-heading">
        <h1>Compare your next connection.</h1>
        <p>
          Published facts in one place. Check each project’s documentation for
          current requirements.
        </p>
      </div>
      <Compare
        initial={(p.tools ?? '').split(',').filter(Boolean)}
        listings={(await catalog()).map(
          ({
            slug,
            name,
            kind,
            summary,
            category,
            pricing,
            transport,
            authentication,
            homepage,
            documentation,
            source,
            agenticCheckedAt,
          }) => ({
            slug,
            name,
            kind,
            summary,
            category,
            pricing,
            transport,
            authentication,
            homepage,
            documentation,
            source,
            agenticCheckedAt,
          }),
        )}
      />
    </main>
  );
}
