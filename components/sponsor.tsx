import Link from 'next/link';
import type { Sponsor } from '@/lib/advertising';
/** Site-wide bar above the telemetry strip. */
export function SponsorBar({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="sponsor-bar">
      <a
        href={sponsor.url}
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
        Advertise
      </Link>
    </div>
  );
}
/** Card-shaped slot inside listing grids. */
export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener sponsored"
      className="sponsor-card"
    >
      <div className="sponsor-card-head">
        <span className="sponsor-monogram" aria-hidden="true">
          {sponsor.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="sponsor-tag">Sponsored</span>
      </div>
      <h3>{sponsor.name}</h3>
      <p>{sponsor.tagline}</p>
      <div className="sponsor-card-foot">
        <span>{new URL(sponsor.url).hostname.replace(/^www\./, '')}</span>
        <span>Visit →</span>
      </div>
    </a>
  );
}
/** Sidebar tile on listing detail pages. */
export function SponsorTile({ sponsor }: { sponsor: Sponsor }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener sponsored"
      className="sponsor-tile glass"
    >
      <span className="sponsor-tag">Sponsored</span>
      <strong>{sponsor.name}</strong>
      <p>{sponsor.tagline}</p>
      <span className="sponsor-tile-link">Visit →</span>
    </a>
  );
}
