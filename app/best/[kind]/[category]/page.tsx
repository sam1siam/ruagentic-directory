import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { bestPage } from '@/lib/server/best';
import { LeaderboardTable } from '@/components/leaderboard-table';
import ToolCard from '@/components/tool-card';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
import { faqJsonLd, type Faq } from '@/lib/faq';
import { compact } from '@/lib/leaderboard';
export const dynamic = 'force-dynamic';
const day = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null;
type Params = Promise<{ kind: string; category: string }>;
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const p = await params;
  const page = await bestPage(p.kind, p.category);
  if (!page) return {};
  const year = new Date().getUTCFullYear();
  return {
    title: `Best ${page.kind.name} for ${page.category.name} (${year}): top ${page.ranked.length} by GitHub stars`,
    description: `${page.count} ${page.kind.name.toLowerCase()} in ${page.category.name} on RUAGENTIC, ranked by public GitHub stars${
      page.collected ? ` collected ${day(page.collected)}` : ''
    }. ${page.ranked[0] ? `#1 is ${page.ranked[0].name} with ${compact(page.ranked[0].stars)} stars.` : ''}`,
    alternates: { canonical: `/best/${page.kind.slug}/${page.category.slug}` },
  };
}
export default async function Page({ params }: { params: Params }) {
  const p = await params;
  const page = await bestPage(p.kind, p.category);
  if (!page) notFound();
  const { kind, category, ranked, unranked, count, collected } = page;
  const kindName = kind.name.toLowerCase();
  const path = `/best/${kind.slug}/${category.slug}`;
  const faq: Faq[] = [
    {
      q: `What is the most-starred ${kind.singular.toLowerCase()} for ${category.name.toLowerCase()}?`,
      a: ranked[0]
        ? `${ranked[0].name}, with ${ranked[0].stars.toLocaleString('en-US')} public GitHub stars${collected ? ` as of ${day(collected)}` : ''}. ${ranked[0].summary}`
        : `No listing in this pair has collected star data yet.`,
    },
    {
      q: `How many ${kindName} for ${category.name.toLowerCase()} are listed?`,
      a: `${count} on RUAGENTIC, ${ranked.length} of them ranked by stars and ${unranked.length} listed without a public GitHub repository or without collected metrics.`,
    },
    {
      q: 'How is this list ranked?',
      a: `By public GitHub star count, read hourly from the repository each listing links to${collected ? `, last collected ${day(collected)}` : ''}. Stars measure attention on GitHub, not quality or safety. Listings that share one repository appear once. Sponsorship never changes a rank.`,
    },
  ];
  return (
    <main className="content-page">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'RUAGENTIC', path: '/' },
            { name: 'Best of', path: '/best' },
            { name: `Best ${kindName} for ${category.name}`, path },
          ]),
          itemListJsonLd(`Best ${kindName} for ${category.name}`, ranked, 20),
          faqJsonLd(faq),
        ]}
      />
      <Link href="/best" className="back-link">
        <ArrowLeft size={15} />
        All best-of lists
      </Link>
      <div className="page-heading">
        <h1>
          Best {kindName} for {category.name.toLowerCase()}.
        </h1>
        <p className="lead">
          {count} {kindName} in{' '}
          <Link href={'/categories/' + category.slug}>{category.name}</Link>.
          The top {ranked.length} are ranked by public GitHub stars
          {collected ? `, collected ${day(collected)}` : ''}; the rest are
          listed below them. {category.description}
        </p>
      </div>
      <LeaderboardTable items={ranked} />
      {unranked.length > 0 && (
        <section className="leaderboard-section">
          <div className="admin-section-head">
            <h2>
              More {kindName} for {category.name.toLowerCase()}{' '}
              <b>{unranked.length}</b>
            </h2>
            <p className="muted">
              Listed without a public GitHub repository, or not yet collected.
            </p>
          </div>
          <div className="listing-grid">
            {unranked.slice(0, 24).map((item) => (
              <ToolCard
                key={item.slug}
                name={item.name}
                kind={item.kind}
                summary={item.summary}
                source={item.source}
                category={item.category}
                href={'/tools/' + item.slug}
              />
            ))}
          </div>
        </section>
      )}
      <section className="faq-section">
        <h2>Questions and answers</h2>
        {faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <p className="muted">
        See every {kind.singular.toLowerCase()} at{' '}
        <Link href={'/' + kind.slug}>/{kind.slug}</Link>, the full{' '}
        <Link
          href={`/leaderboards/${kind.slug}?category=${encodeURIComponent(category.name)}`}
        >
          {kindName} leaderboard for {category.name.toLowerCase()}
        </Link>
        , or <Link href="/submit">list your project</Link>.
      </p>
    </main>
  );
}
