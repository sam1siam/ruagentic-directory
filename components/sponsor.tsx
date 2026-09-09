import Link from 'next/link';
import { sponsorHref, type Sponsor } from '@/lib/advertising';
function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
/** Site-wide bar above the telemetry strip. The bar is the one placement
 *  that links straight out, carrying the directory referrer. */
export function SponsorBar({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="sponsor-bar">
      <a
        href={sponsorHref(sponsor.url)}
        target="_blank"
        rel="noopener sponsored"
        className="sponsor-bar-link"
      >
        <span className="sponsor-label">Sponsored by</span>
        <span className="sponsor-chip">{sponsor.name}</span>
        <span className="sponsor-tagline">— {sponsor.tagline}</span>
        <span className="sponsor-arrow" aria-hidden="true">
          →
        </span>
      </a>
      <Link href="/advertise" className="sponsor-cta">
        Advertise with us →
      </Link>
    </div>
  );
}
/** Card-shaped slot inside listing grids; opens the sponsor's page on the
 *  directory like any other card. */
export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Link href={sponsor.page} className="sponsor-card">
      <div className="sponsor-card-head">
        <span className="sponsor-monogram" aria-hidden="true">
          {sponsor.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="sponsor-tag">Sponsored</span>
      </div>
      <h3>{sponsor.name}</h3>
      <p>{sponsor.description || sponsor.tagline}</p>
      <div className="sponsor-card-foot">
        <span>{hostname(sponsor.url)}</span>
        <span>{sponsor.cta || 'Learn more'} →</span>
      </div>
    </Link>
  );
}
/** Sidebar tile on listing detail pages. */
export function SponsorTile({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Link href={sponsor.page} className="sponsor-tile glass">
      <span className="sponsor-tag">Sponsored</span>
      <strong>{sponsor.name}</strong>
      <p>{sponsor.description || sponsor.tagline}</p>
      <span className="sponsor-tile-link">{sponsor.cta || 'Learn more'} →</span>
    </Link>
  );
}
/** Outbound button used on sponsor and listing pages. */
export function SponsorVisit({ sponsor }: { sponsor: Sponsor }) {
  return (
    <a
      href={sponsorHref(sponsor.url)}
      target="_blank"
      rel="noopener sponsored"
      className="button primary"
    >
      {sponsor.cta || 'Visit ' + sponsor.name} ↗
    </a>
  );
}
