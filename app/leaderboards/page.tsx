import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { kinds } from '@/lib/categories';
import { leaderboard, metricsCollectedAt } from '@/lib/server/metrics';
import { parseRankBy } from '@/lib/leaderboard';
import {
  LeaderboardMethod,
  LeaderboardTable,
} from '@/components/leaderboard-table';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Leaderboards',
  description:
    'MCP servers, clients, AI agents, skills, plugins, rules files and evals ranked by public GitHub stars, or by stars per day since launch, with the update date shown.',
  alternates: { canonical: '/leaderboards' },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const by = parseRankBy((await searchParams).by);
  const [collected, boards] = await Promise.all([
    metricsCollectedAt(),
    Promise.all(
      kinds.map(async (page) => ({
        page,
        items: await leaderboard(page.kind, 10, by),
      })),
    ),
  ]);
  const suffix = by === 'pace' ? '?by=pace' : '';
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
          {by === 'pace'
            ? 'The fastest-growing listings of each type: public GitHub stars per day since the repository was created.'
            : 'The most-starred listings of each type, from the public GitHub repositories the directory links to.'}
        </p>
      </div>
      <LeaderboardMethod collected={collected} base="/leaderboards" by={by} />
      {boards.map(({ page, items }) => (
        <section className="leaderboard-section" key={page.slug}>
          <div className="admin-section-head">
            <h2>
              <Link href={'/leaderboards/' + page.slug + suffix}>
                {page.name}
              </Link>
            </h2>
            <Link
              href={'/leaderboards/' + page.slug + suffix}
              className="text-link"
            >
              Top 100 {page.name.toLowerCase()}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <LeaderboardTable items={items} by={by} />
        </section>
      ))}
    </main>
  );
}
