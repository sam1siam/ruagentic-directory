import Link from 'next/link';
import AdvertiseForm from '@/components/advertise-form';
import { directoryStats } from '@/lib/server/stats';
import { categoryExtraAmount, formatUsd } from '@/lib/advertising';
import { reviewWindow } from '@/lib/admin-policy';
import { configured, userClient } from '@/lib/supabase/server';
import { ownedOrders } from '@/lib/server/sponsorships';
export const metadata = {
  title: 'Advertise',
  description:
    'Sponsor RUAGENTIC: a site-wide top bar, a featured card in the categories you choose, or both, billed monthly.',
  alternates: { canonical: '/advertise' },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [p, stats] = await Promise.all([searchParams, directoryStats()]);
  let account: { email: string; orders: number } | null = null;
  if (configured()) {
    try {
      const { data } = await (await userClient()).auth.getUser();
      if (data.user?.email) {
        const orders = data.user.email_confirmed_at
          ? await ownedOrders({
              id: data.user.id,
              email: data.user.email,
              confirmed: true,
            })
          : [];
        account = { email: data.user.email, orders: orders.length };
      }
    } catch {
      account = null;
    }
  }
  return (
    <main className="content-page advertise-page">
      <div className="page-heading">
        <h1>Sponsor the directory.</h1>
        <p className="lead">
          Reach the people building with MCP servers, clients and agentic
          products. Pick a placement, submit your creative, and go live once we
          approve it, within {reviewWindow} of payment.
        </p>
      </div>
      {account && account.orders > 0 && (
        <div className="notice">
          You have {account.orders} sponsorship
          {account.orders === 1 ? '' : 's'} on this account.{' '}
          <Link href="/dashboard">Manage billing and creatives</Link> from your
          dashboard, or buy another placement below.
        </div>
      )}
      <div className="advertise-layout">
        <AdvertiseForm
          cancelled={p.cancelled === '1'}
          signedIn={Boolean(account)}
          email={account?.email}
        />
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
            <li>
              Sign in or create an account, then pay securely by card through
              Stripe. Your account is where you manage billing, edit the
              creative or cancel later.
            </li>
            <li>
              We review your creative and approve it within {reviewWindow}. Your
              placement goes live the moment it is approved, and we email you
              then. Stripe sends the receipt and a link to manage or cancel.
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
