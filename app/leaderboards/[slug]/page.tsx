import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { kindBySlug, kinds } from '@/lib/categories';
import { leaderboard, metricsCollectedAt } from '@/lib/server/metrics';
import {
  LeaderboardMethod,
  LeaderboardTable,
} from '@/components/leaderboard-table';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
import type { Metadata } from 'next';
export const revalidate = 600;
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
    description: `The 100 most-starred ${page.name.toLowerCase()} on RUAGENTIC, ranked by public GitHub stars with the collection date shown.`,
    alternates: { canonical: '/leaderboards/' + page.slug },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const page = kindBySlug((await params).slug);
  if (!page) notFound();
  const [collected, items] = await Promise.all([
    metricsCollectedAt(),
    leaderboard(page.kind, 100),
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
      <LeaderboardMethod collected={collected} />
      <LeaderboardTable items={items} />
    </main>
  );
}
