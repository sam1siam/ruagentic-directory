export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import Link from 'next/link';
import { catalog } from '@/lib/server/catalog';
import { directoryStats } from '@/lib/server/stats';
import { categories, categoryHref } from '@/lib/categories';
import { CornerBrackets } from '@/components/design-interactions';
import { CategoryCardsSkeleton } from '@/components/skeletons';
export const metadata = {
  title: 'Categories',
  description:
    'Browse MCP servers, clients and AI agents by category, from developer tools and data to automation and finance.',
};
/** The skeleton lives inside the page rather than in a loading file so it
 *  never wraps the category child routes, whose unknown slugs must 404. */
export default function Page() {
  return (
    <Suspense fallback={<CategoryCardsSkeleton />}>
      <CategoryIndex />
    </Suspense>
  );
}
async function CategoryIndex() {
  const [items, stats] = await Promise.all([catalog(), directoryStats()]);
  const age = stats.updatedDays;
  return (
    <main className="content-page collections-page">
      <div className="collections-heading">
        <div>
          <h1>Browse by category.</h1>
          <p className="lead">
            Every listing sits in one of twenty categories. Open one to filter
            it further by type, search and sort.
          </p>
        </div>
        <dl className="stat-grid">
          <div>
            <dt>TOOLS</dt>
            <dd>{stats.total}</dd>
          </div>
          <div>
            <dt>CATEGORIES</dt>
            <dd>{categories.length}</dd>
          </div>
          <div>
            <dt>UPDATED</dt>
            <dd>{age === null ? '—' : age === 0 ? 'today' : age + 'd'}</dd>
          </div>
        </dl>
      </div>
      <div className="collection-grid">
        {categories.map((c) => {
          const members = items.filter((item) => item.category === c.name);
          return (
            <Link
              className="collection-card glass"
              key={c.slug}
              href={categoryHref(c)}
            >
              <span className="card-glow" aria-hidden="true" />
              <CornerBrackets small diagonal />
              <div className="collection-top">
                <span>{members.length} TOOLS</span>
              </div>
              <h2>{c.name}</h2>
              <p>{c.description}</p>
              <div className="collection-bottom">
                <div className="collection-members" aria-hidden="true">
                  {members.slice(0, 3).map((p) => (
                    <i key={p.slug} title={p.name}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </i>
                  ))}
                </div>
                <span className="collection-open">OPEN →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
