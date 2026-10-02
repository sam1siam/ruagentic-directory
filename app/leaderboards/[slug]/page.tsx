import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { kindBySlug, kinds } from '@/lib/categories';
import { leaderboard, metricsCollectedAt } from '@/lib/server/metrics';
import { parseRankBy } from '@/lib/leaderboard';
import { filtersFromParams } from '@/lib/browse';
import {
  LeaderboardFilters,
  LeaderboardMethod,
  LeaderboardTable,
} from '@/components/leaderboard-table';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const dynamicParams = false;
export function generateStaticParams() {
  return kinds.map((k) => ({ slug: k.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const page = kindBySlug((await params).slug);
  if (!page) return {};
  return {
    title: `${page.name} leaderboard`,
    description: `The 100 most-starred ${page.name.toLowerCase()} on RUAGENTIC, ranked by public GitHub stars or by stars per day since launch, with the update date shown.`,
    alternates: { canonical: '/leaderboards/' + page.slug },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = kindBySlug((await params).slug);
  if (!page) notFound();
  const query = await searchParams;
  const by = parseRankBy(query.by);
  const filters = filtersFromParams(query);
  const [collected, items] = await Promise.all([
    metricsCollectedAt(),
    leaderboard(page.kind, 100, by, filters),
  ]);
  return (
    <main className="content-page">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'RUAGENTIC', path: '/' },
            { name: 'Leaderboards', path: '/leaderboards' },
            { name: page.name, path: '/leaderboards/' + page.slug },
          ]),
          itemListJsonLd(`${page.name} leaderboard`, items, 100),
        ]}
      />
      <Link href="/leaderboards" className="back-link">
        <ArrowLeft size={15} />
        All leaderboards
      </Link>
      <div className="page-heading">
        <h1>{page.name} leaderboard.</h1>
        <p className="lead">
          {page.description} Browse all of them at{' '}
          <Link href={'/' + page.slug}>/{page.slug}</Link>.
        </p>
      </div>
      <LeaderboardMethod
        collected={collected}
        base={'/leaderboards/' + page.slug}
        by={by}
        filters={filters}
      />
      <LeaderboardFilters
        base={'/leaderboards/' + page.slug}
        by={by}
        filters={filters}
      />
      <LeaderboardTable items={items} by={by} />
    </main>
  );
}
