import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Globe,
  BookOpen,
  GitBranch,
  Link2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { catalog, listingBySlug } from '@/lib/server/catalog';
import ListingActions from '@/components/listing-actions';
import ConnectGuide from '@/components/connect-guide';
import { listingJsonLd } from '@/lib/seo';
import { SponsorTile } from '@/components/sponsor';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsor } from '@/lib/advertising';
import { categoryByName } from '@/lib/categories';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = await listingBySlug((await params).slug);
  return item
    ? {
        title: item.name,
        description: item.summary,
        alternates: { canonical: '/tools/' + item.slug },
        openGraph: {
          title: item.name + ' on RUAGENTIC',
          description: item.summary,
        },
      }
    : { title: 'Listing not found' };
}
const display = (value: string) =>
  !value || value === 'unknown' ? 'Not specified' : value.replaceAll('-', ' ');
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const item = await listingBySlug((await params).slug);
  if (!item) notFound();
  const related = (await catalog())
    .filter((p) => p.slug !== item.slug && p.category === item.category)
    .slice(0, 3);
  const sponsor = pickSponsor(
    'detail',
    await activeSponsors(),
    undefined,
    categoryByName(item.category)?.slug,
  );
  const remotes = (item.remotes ?? []) as {
    type?: string;
    url?: string;
    headers?: { name: string; description?: string }[];
  }[];
  const packages = (item.packages ?? []) as {
    registryType?: string;
    identifier?: string;
    version?: string;
    transport?: { type?: string };
  }[];
  const jsonLd = listingJsonLd(
    item,
    'https://ruagentic.com/tools/' + encodeURIComponent(item.slug),
  );
  return (
    <main className="content-page detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c'),
        }}
      />
      <Link href="/" className="back-link">
        <ArrowLeft size={15} />
        All tools
      </Link>
      <div className="detail-hero">
        <span className="project-monogram large">{item.name.slice(0, 2)}</span>
        <div>
          <span className="type-label">
            {item.kind === 'server'
              ? 'MCP SERVER'
              : item.kind === 'client'
                ? 'MCP CLIENT'
                : 'AI AGENT'}
          </span>
          <h1>{item.name}</h1>
          <p>{item.summary}</p>
          <div className="listing-tags">
            <span>{item.category}</span>
            {item.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <a
          href={item.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="button primary"
        >
          Visit project
          <ArrowUpRight size={17} />
        </a>
      </div>
      <ListingActions slug={item.slug} />
      <div className="detail-layout">
        <div className="detail-body">
          <section>
            <h2>About {item.name}</h2>
            <p className="preserve-lines">{item.description}</p>
          </section>
          {item.capabilities.length > 0 && (
            <section>
              <h2>What you can do</h2>
              <ul className="capability-list">
                {item.capabilities.map((c) => (
                  <li key={c}>
                    <CheckCircle2 size={17} />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2>How to connect</h2>
            <ConnectGuide item={item} />
            <div className="resource-links">
              {[
                [Globe, 'Project website', item.homepage],
                [BookOpen, 'Documentation', item.documentation],
                [GitBranch, 'Source repository', item.repository],
              ]
                .filter(([, , url]) => url)
                .map(([Icon, label, url]) => {
                  const I = Icon as typeof Globe;
                  return (
                    <a
                      key={String(label)}
                      href={String(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <I size={17} />
                      <span>{String(label)}</span>
                      <ArrowUpRight size={15} />
                    </a>
                  );
                })}
            </div>
            {item.endpoint && (
              <div className="endpoint">
                <span className="label">REMOTE ENDPOINT</span>
                <code>{item.endpoint}</code>
                <small>
                  Use this URL in a compatible client. Follow the provider’s
                  authentication instructions.
                </small>
              </div>
            )}
            {remotes.length > 0 && (
              <details className="connection-details">
                <summary>
                  {remotes.length} published remote connection
                  {remotes.length === 1 ? '' : 's'}
                </summary>
                {remotes.map((r, index) => (
                  <div className="connection" key={index}>
                    <strong>{r.type ?? 'Remote'}</strong>
                    <code>{r.url}</code>
                    {r.headers?.map((h) => (
                      <p key={h.name}>
                        {h.name}
                        {h.description ? ' — ' + h.description : ''}
                      </p>
                    ))}
                  </div>
                ))}
              </details>
            )}
            {packages.length > 0 && (
              <details className="connection-details" open>
                <summary>Published packages</summary>
                {packages.map((p, index) => (
                  <div className="connection" key={index}>
                    <strong>{p.registryType}</strong>
                    <code>
                      {p.identifier}
                      {p.version ? ' @ ' + p.version : ''}
                    </code>
                    {p.transport?.type && (
                      <small>Transport: {p.transport.type}</small>
                    )}
                  </div>
                ))}
              </details>
            )}
          </section>
          <section className="source-panel">
            <h2>Sources and checks</h2>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              View the source
              <ArrowUpRight size={14} />
            </a>
            {item.registry && (
              <p>
                Registry name: <code>{item.registry.name}</code>
                <br />
                Published version: {item.registry.version}
              </p>
            )}
            <p className="muted">
              <Clock size={14} /> Source information collected{' '}
              {new Date(item.observedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
              .
            </p>
            {item.agenticCheckedAt && (
              <p>
                <CheckCircle2 size={16} /> Agentic Protocol files checked{' '}
                {new Date(item.agenticCheckedAt).toLocaleDateString()}. This
                check covers published files, not ownership or service security.
              </p>
            )}
          </section>
        </div>
        <aside className="details-sidebar">
          <h3>At a glance</h3>
          <dl className="facts">
            {[
              ['Category', item.category],
              ['Pricing', display(item.pricing)],
              ['Transport', display(item.transport)],
              ['Authentication', display(item.authentication)],
              ['License', item.license || 'Not specified'],
              ['Platforms', item.platforms.join(', ') || 'See documentation'],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {sponsor && <SponsorTile sponsor={sponsor} />}
          <div className="sidebar-guide glass">
            <Link2 size={21} />
            <strong>Building something agentic?</strong>
            <p>Give your project a place in the directory.</p>
            <Link href="/submit">Submit your project ↗</Link>
          </div>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="related-section">
          <h2>More in {item.category}</h2>
          <div className="related-grid">
            {related.map((p) => (
              <Link href={'/tools/' + p.slug} key={p.slug}>
                <span className="project-monogram">{p.name.slice(0, 2)}</span>
                <strong>{p.name}</strong>
                <p>{p.summary}</p>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
