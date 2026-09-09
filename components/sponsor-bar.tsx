'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sponsorHref, type Sponsor } from '@/lib/advertising';
/** Site-wide bar above the telemetry strip. Rotates through the ordered
 *  sponsors on the admin-set interval, pausing while hovered. The bar is the
 *  one placement that links straight out, carrying the directory referrer. */
export default function SponsorBar({
  sponsors,
  intervalSeconds,
}: {
  sponsors: Sponsor[];
  intervalSeconds: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = sponsors.length;
  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % count),
      Math.max(5, intervalSeconds) * 1000,
    );
    return () => clearInterval(timer);
  }, [count, paused, intervalSeconds]);
  const sponsor = sponsors[index % Math.max(count, 1)];
  if (!sponsor) return null;
  return (
    <div
      className="sponsor-bar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <a
        key={sponsor.name + index}
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
      {count > 1 && (
        <span className="sponsor-dots" aria-hidden="true">
          {sponsors.map((s, i) => (
            <i key={s.name + i} data-on={i === index % count} />
          ))}
        </span>
      )}
      <Link href="/advertise" className="sponsor-cta">
        Advertise with us →
      </Link>
    </div>
  );
}
