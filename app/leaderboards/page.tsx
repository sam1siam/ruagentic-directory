import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { kinds } from '@/lib/categories';
import { leaderboard, metricsCollectedAt } from '@/lib/server/metrics';
import {
  LeaderboardMethod,
  LeaderboardTable,
} from '@/components/leaderboard-table';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
export const revalidate = 600;
export const metadata = {
  title: 'Leaderboards',
  description:
    'MCP servers, clients, AI agents, skills, plugins, rules files and evals ranked by public GitHub stars, with the collection date shown.',
  alternates: { canonical: '/leaderboards' },
};
export default async function Page() {
  const [collected, boards] = await Promise.all([
    metricsCollectedAt(),
    Promise.all(
      kinds.map(async (page) => ({
        page,
        items: await leaderboard(page.kind, 10),
      })),
    ),
  ]);
  return (
    <main className="content-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'RUAGENTIC', path: '/' },
          { name: 'Leaderboards', path: '/leaderboards' },
        ])}
      />
      <div className="page-heading">
        <h1>Leaderboards.</h1>
        <p className="lead">
          The most-starred listings of each type, from the public GitHub
          repositories the directory links to.
        </p>
      </div>
      <LeaderboardMethod collected={collected} />
      {boards.map(({ page, items }) => (
        <section className="leaderboard-section" key={page.slug}>
          <div className="admin-section-head">
            <h2>
              <Link href={'/leaderboards/' + page.slug}>{page.name}</Link>
            </h2>
            <Link href={'/leaderboards/' + page.slug} className="text-link">
              Top 100 {page.name.toLowerCase()}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <LeaderboardTable items={items} />
        </section>
      ))}
    </main>
  );
}
