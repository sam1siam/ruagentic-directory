import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { sponsorBySlug } from '@/lib/server/sponsors';
import { placementById } from '@/lib/advertising';
import { categoryBySlug, categoryHref } from '@/lib/categories';
import { SponsorVisit } from '@/components/sponsor';
import { CornerBrackets } from '@/components/design-interactions';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const sponsor = await sponsorBySlug((await params).slug);
  return sponsor
    ? {
        title: sponsor.name + ' (sponsor)',
        description: sponsor.tagline,
        robots: { index: false, follow: false },
      }
    : { title: 'Sponsor not found', robots: { index: false } };
}
/** A paid sponsor's page on the directory: the card and tile open this, and
 *  the outbound link lives here. Sponsored pages stay out of search indexes
 *  so sponsorship never touches the directory's own rankings. */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const sponsor = await sponsorBySlug((await params).slug);
  if (!sponsor) notFound();
  const placement = placementById(sponsor.placement);
  const cats = sponsor.categories
    .map((s) => categoryBySlug(s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return (
    <main className="content-page sponsor-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} /> All tools
      </Link>
      <section className="sponsor-hero glass">
        <CornerBrackets amber />
        <span className="sponsor-tag">Sponsored placement</span>
        <div className="sponsor-hero-head">
          <span className="sponsor-monogram large" aria-hidden="true">
            {sponsor.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1>{sponsor.name}</h1>
            <p className="lead">{sponsor.tagline}</p>
          </div>
        </div>
        {sponsor.description && <p>{sponsor.description}</p>}
        <div className="actions">
          <SponsorVisit sponsor={sponsor} />
        </div>
        <dl className="sponsor-facts">
          <div>
            <dt>Placement</dt>
            <dd>{placement?.name ?? sponsor.placement}</dd>
          </div>
          {cats.length > 0 && (
            <div>
              <dt>Categories</dt>
              <dd>
                {cats.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && ', '}
                    <Link href={categoryHref(c)}>{c.name}</Link>
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>
      <p className="muted">
        This is a paid placement. Sponsorship never changes rankings, source
        labels or Agentic Protocol checks. Want your product here?{' '}
        <Link href="/advertise">Sponsor the directory</Link>.
      </p>
    </main>
  );
}
