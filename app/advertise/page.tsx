import Link from 'next/link';
import AdvertiseForm from '@/components/advertise-form';
import { directoryStats } from '@/lib/server/stats';
export const metadata = {
  title: 'Advertise',
  description:
    'Sponsor RUAGENTIC: monthly Platinum, Gold and Silver placements across the agentic directory.',
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [p, stats] = await Promise.all([searchParams, directoryStats()]);
  return (
    <main className="content-page advertise-page">
      <div className="page-heading">
        <h1>Sponsor the directory.</h1>
        <p className="lead">
          Reach the people building with MCP servers, clients and agentic
          products. Pick a placement, submit your creative, and go live right
          after payment.
        </p>
      </div>
      <div className="advertise-layout">
        <AdvertiseForm cancelled={p.cancelled === '1'} />
        <aside className="advertise-aside">
          <div className="stat-grid">
            <div>
              <dt>LISTINGS</dt>
              <dd>{stats.total}</dd>
            </div>
            <div>
              <dt>SERVERS</dt>
              <dd>{stats.servers}</dd>
            </div>
            <div>
              <dt>CLIENTS</dt>
              <dd>{stats.clients}</dd>
            </div>
          </div>
          <h2>How it works</h2>
          <ol className="advertise-steps">
            <li>Choose a sponsor tier and submit your ad creative.</li>
            <li>Pay securely by card through Stripe.</li>
            <li>
              Your placement goes live within minutes and stays live while the
              subscription is active.
            </li>
          </ol>
          <h2>Where you appear</h2>
          <ul className="advertise-steps">
            <li>
              <strong>Platinum</strong> owns the site-wide bar at the top of
              every page, plus listing and detail placements.
            </li>
            <li>
              <strong>Gold</strong> takes the first card on listing pages and a
              tile on every listing detail page.
            </li>
            <li>
              <strong>Silver</strong> takes the detail page tile.
            </li>
          </ul>
          <h2>What sponsorship is not</h2>
          <p>
            Sponsorship never changes rankings, source labels, or Agentic file
            checks, and it is labelled as sponsored wherever it appears.
            Creatives follow the{' '}
            <Link href="/guidelines">listing guidelines</Link>. Questions:{' '}
            <Link href="/contact">contact us</Link>.
          </p>
        </aside>
      </div>
    </main>
  );
}
