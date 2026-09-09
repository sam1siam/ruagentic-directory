import Link from 'next/link';
import AdvertiseForm from '@/components/advertise-form';
import { directoryStats } from '@/lib/server/stats';
import { categoryExtraAmount, formatUsd } from '@/lib/advertising';
export const metadata = {
  title: 'Advertise',
  description:
    'Sponsor RUAGENTIC: a site-wide top bar, a featured card in the categories you choose, or both, billed monthly.',
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
            <li>
              Choose a placement, your categories and submit your creative.
            </li>
            <li>Pay securely by card through Stripe.</li>
            <li>
              Your placement goes live within minutes and stays live while the
              subscription is active. You get a confirmation email with your
              sponsor page link; Stripe sends the receipt and a link to manage
              or cancel.
            </li>
          </ol>
          <h2>Where you appear</h2>
          <ul className="advertise-steps">
            <li>
              <strong>Top bar</strong> puts your name and tagline in the sponsor
              bar at the top of every page, linked straight to your site.
            </li>
            <li>
              <strong>Featured card</strong> takes the first card on the
              category pages you choose, on the server, client and product pages
              and the home page, plus a tile on listing detail pages in your
              categories. One category is included; each extra category is{' '}
              {formatUsd(categoryExtraAmount)} a month. The card opens your
              sponsor page on the directory, which links to your site.
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
