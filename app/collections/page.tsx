export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { catalog } from '@/lib/server/catalog';
import { directoryStats } from '@/lib/server/stats';
import { collections, collectionHref, inCollection } from '@/lib/collections';
import { CornerBrackets } from '@/components/design-interactions';
export const metadata = {
  title: 'Collections',
  description:
    'Explore MCP servers and agentic tools by workflow, from coding and research to data and automation.',
};
export default async function Page() {
  const [items, stats] = await Promise.all([catalog(), directoryStats()]);
  const age = stats.updatedDays;
  return (
    <main className="content-page collections-page">
      <div className="collections-heading">
        <div>
          <h1>Start with a collection.</h1>
          <p className="lead">
            Useful ways into the ecosystem, organized around what you want to
            do.
          </p>
        </div>
        <dl className="stat-grid">
          <div>
            <dt>TOOLS</dt>
            <dd>{stats.total}</dd>
          </div>
          <div>
            <dt>TYPES</dt>
            <dd>{new Set(items.map((item) => item.kind)).size}</dd>
          </div>
          <div>
            <dt>UPDATED</dt>
            <dd>{age === null ? '—' : age === 0 ? 'today' : age + 'd'}</dd>
          </div>
        </dl>
      </div>
      <div className="collection-grid">
        {collections.map((c) => {
          const members = items.filter((item) => inCollection(c, item));
          return (
            <Link
              className="collection-card glass"
              key={c.name}
              href={collectionHref(c)}
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
