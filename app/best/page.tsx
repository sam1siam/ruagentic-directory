import Link from 'next/link';
import type { Metadata } from 'next';
import { bestCombos } from '@/lib/server/best';
import { kinds } from '@/lib/categories';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const combos = await bestCombos();
  return {
    title: `Best of RUAGENTIC: ${combos.length} ranked lists by type and category`,
    description: `The most-starred MCP servers, clients, AI agents, skills, plugins, rules files and evals in every category, ranked by public GitHub stars and updated daily.`,
    alternates: { canonical: '/best' },
  };
}
export default async function Page() {
  const combos = await bestCombos();
  return (
    <main className="content-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'RUAGENTIC', path: '/' },
          { name: 'Best of', path: '/best' },
        ])}
      />
      <div className="page-heading">
        <h1>Best of, by type and category.</h1>
        <p className="lead">
          {combos.length} ranked lists. Each one ranks the listings of one type
          in one category by public GitHub stars, names every other listing in
          that pair, and is refreshed as the directory grows.
        </p>
      </div>
      {kinds.map((kind) => {
        const own = combos.filter((c) => c.kind.slug === kind.slug);
        if (!own.length) return null;
        return (
          <section className="leaderboard-section" key={kind.slug}>
            <div className="admin-section-head">
              <h2>{kind.name}</h2>
            </div>
            <ul className="best-list">
              {own.map((c) => (
                <li key={c.category.slug}>
                  <Link href={`/best/${kind.slug}/${c.category.slug}`}>
                    Best {kind.name.toLowerCase()} for{' '}
                    {c.category.name.toLowerCase()}
                  </Link>
                  <small>{c.count}</small>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
