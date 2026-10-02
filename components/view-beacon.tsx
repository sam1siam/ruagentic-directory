'use client';
import { useEffect } from 'react';
/** Sends one view ping for a listing page. Automation and preview renders
 *  are skipped; the server also filters crawlers. */
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.webdriver) return;
    const body = JSON.stringify({ slug });
    const sent =
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(
        '/api/views',
        new Blob([body], { type: 'application/json' }),
      );
    if (!sent)
      fetch('/api/views', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      }).catch(() => {});
  }, [slug]);
  return null;
}
