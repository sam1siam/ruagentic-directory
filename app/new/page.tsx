import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import { catalog } from '@/lib/server/catalog';
import { browserMetrics } from '@/lib/server/metrics';
import { kinds } from '@/lib/categories';
import ToolCard from '@/components/tool-card';
import JsonLd from '@/components/json-ld';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo';
export const dynamic = 'force-dynamic';
const DAY = 86_400_000;
export async function generateMetadata(): Promise<Metadata> {
  const items = await catalog();
  const recent = items.filter(
    (i) => Date.now() - Date.parse(i.publishedAt || i.observedAt) <= 7 * DAY,
  ).length;
  return {
    title: `New this week: ${recent} MCP servers, agents, skills and more`,
    description: `${recent} listings added to RUAGENTIC in the last 7 days, plus projects whose repositories launched in the last 30 days. Updated daily from eleven public sources.`,
    alternates: { canonical: '/new' },
  };
}
/** Added in the last 7 days (directory date) and launched in the last 30
 *  (repository creation date). Kept out of the component so the clock read
 *  happens in plain data loading, not during render. */
async function recent() {
  const [items, metrics] = await Promise.all([catalog(), browserMetrics()]);
  const now = Date.now();
  const added = items.filter(
    (i) => now - Date.parse(i.publishedAt || i.observedAt) <= 7 * DAY,
  );
  const launched = items.filter((i) => {
    const created = metrics.get(i.slug)?.createdAt;
    return (
      created &&
      now - Date.parse(created) <= 30 * DAY &&
      !added.some((a) => a.slug === i.slug)
    );
  });
  return { items, metrics, added, launched };
}
export default async function Page() {
  const { items, metrics, added, launched } = await recent();
  const byKind = (list: typeof items) =>
    kinds
      .map((k) => ({ page: k, items: list.filter((i) => i.kind === k.kind) }))
      .filter((g) => g.items.length);
  const sections = [
    {
      id: 'added',
      title: 'Added this week',
      note: 'Listed on RUAGENTIC in the last 7 days.',
      groups: byKind(added),
      total: added.length,
    },
    {
      id: 'launched',
      title: 'Launched this month',
      note: 'Repositories created in the last 30 days, by their GitHub creation date.',
      groups: byKind(launched),
      total: launched.length,
    },
  ];
  return (
    <main className="content-page">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'RUAGENTIC', path: '/' },
            { name: 'New this week', path: '/new' },
          ]),
          itemListJsonLd('New this week', added, 50),
        ]}
      />
      <div className="page-heading">
        <h1>New this week.</h1>
        <p className="lead">
          {added.length} listings added in the last 7 days and {launched.length}{' '}
          projects launched in the last 30. The directory checks eleven public
          sources every day; the fastest risers are on the{' '}
          <Link href="/leaderboards?by=pace">leaderboards</Link>.
        </p>
      </div>
      {sections.map((section) => (
        <section className="leaderboard-section" key={section.id}>
          <div className="admin-section-head">
            <h2>
              {section.title} <b>{section.total}</b>
            </h2>
            <p className="muted">{section.note}</p>
          </div>
          {section.groups.length === 0 ? (
            <p className="muted">Nothing yet. Check back tomorrow.</p>
          ) : (
            section.groups.map(({ page, items: group }) => (
              <div className="new-group" key={page.slug}>
                <h3>
                  <Link href={'/' + page.slug}>{page.name}</Link>{' '}
                  <small>{group.length}</small>
                  <Link
                    href={'/' + page.slug + '?sort=recent'}
                    className="text-link"
                  >
                    All {page.name.toLowerCase()}
                    <ArrowUpRight size={14} />
                  </Link>
                </h3>
                <div className="listing-grid">
                  {group.slice(0, 12).map((item) => (
                    <ToolCard
                      key={item.slug}
                      name={item.name}
                      kind={item.kind}
                      summary={item.summary}
                      source={item.source}
                      category={item.category}
                      stars={metrics.get(item.slug)?.stars ?? null}
                      href={'/tools/' + item.slug}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      ))}
    </main>
  );
}
