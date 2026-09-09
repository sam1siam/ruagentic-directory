import Link from 'next/link';
import AdvertiseForm from '@/components/advertise-form';
import { directoryStats } from '@/lib/server/stats';
export const metadata = {
  title: 'Advertise',
  description:
    'Sponsor RUAGENTIC: a site-wide top bar, a featured card in the listing grids, or both, billed monthly.',
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
            <li>Choose a placement and submit your ad creative.</li>
            <li>Pay securely by card through Stripe.</li>
            <li>
              Your placement goes live within minutes and stays live while the
              subscription is active.
            </li>
          </ol>
          <h2>Where you appear</h2>
          <ul className="advertise-steps">
            <li>
              <strong>Top bar</strong> puts your name and tagline in the sponsor
              bar at the top of every page.
            </li>
            <li>
              <strong>Featured card</strong> takes the first card on the home
              page and every listing page, plus a tile on every listing detail
              page. It needs a short description and an optional button label.
            </li>
            <li>
              <strong>Top bar + featured card</strong> combines both for less
              than buying them separately.
            </li>
          </ul>
          <h2>What sponsorship is not</h2>
          <p>
            Sponsorship never changes rankings, source labels, or Agentic
            Protocol file checks, and it is labelled as sponsored wherever it
            appears. Creatives follow the{' '}
            <Link href="/guidelines">listing guidelines</Link>. Questions:{' '}
            <Link href="/contact">contact us</Link>.
          </p>
        </aside>
      </div>
    </main>
  );
}
