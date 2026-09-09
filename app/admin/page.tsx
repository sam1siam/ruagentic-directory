import Link from 'next/link';
import { actionRows, overview } from '@/lib/server/admin';
import { formatUsd } from '@/lib/advertising';
import { seedDemo } from './actions';
export const maxDuration = 90;
const ranges = [7, 14, 30, 90];
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; notice?: string }>;
}) {
  const { days: raw, notice } = await searchParams;
  const days = ranges.includes(Number(raw)) ? Number(raw) : 14;
  const [data, log] = await Promise.all([overview(days), actionRows()]);
  const max = Math.max(
    1,
    ...data.series.map((d) => d.signups + d.free + d.paid + d.sponsors),
  );
  return (
    <>
      {notice && <output className="notice">{notice.slice(0, 600)}</output>}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Right now</h2>
        </div>
        <div className="kpi-grid">
          <Link href="/admin/sponsors" className="kpi highlight">
            <span>Sponsorships awaiting approval</span>
            <b>{data.pendingSponsors}</b>
            <small>Promise: a decision within 24–48 hours</small>
          </Link>
          <div className="kpi">
            <span>Approved sponsorships live</span>
            <b>{data.activeSponsors}</b>
            <small>
              {formatUsd(data.monthlyRevenueCents)} a month (live mode)
            </small>
          </div>
          <Link href="/admin/reports" className="kpi">
            <span>Open listing reports</span>
            <b>{data.openReports}</b>
          </Link>
          <Link href="/admin/email" className="kpi">
            <span>Email delivery problems</span>
            <b>{data.emailProblems}</b>
          </Link>
          <div className="kpi">
            <span>Live user listings</span>
            <b>{data.liveListings}</b>
            <small>{data.drafts} drafts in progress</small>
          </div>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Activity</h2>
        </div>
        <div className="table-scroll">
          <table className="admin-table stats">
            <thead>
              <tr>
                <th>Window</th>
                <th>Accounts created</th>
                <th>Free listings (Agentic Protocol)</th>
                <th>Paid listings</th>
                <th>Submissions started</th>
                <th>Sponsorship orders</th>
              </tr>
            </thead>
            <tbody>
              {data.tiles.map((t) => (
                <tr key={t.label}>
                  <th scope="row">{t.label}</th>
                  <td>{t.signups}</td>
                  <td>{t.free}</td>
                  <td>{t.paid}</td>
                  <td>{t.submissions}</td>
                  <td>{t.sponsors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>By day</h2>
          <nav className="range-picker" aria-label="Range">
            {ranges.map((r) => (
              <Link
                key={r}
                href={'/admin?days=' + r}
                aria-current={r === days ? 'page' : undefined}
              >
                {r}d
              </Link>
            ))}
          </nav>
        </div>
        <div className="bars" aria-hidden="true">
          {data.series.map((d) => {
            const total = d.signups + d.free + d.paid + d.sponsors;
            return (
              <div
                className="bar-col"
                key={d.date}
                title={`${d.date}: ${d.signups} accounts, ${d.free} free, ${d.paid} paid, ${d.sponsors} sponsors`}
              >
                <div
                  className="bar"
                  style={{ height: (total / max) * 100 + '%' }}
                >
                  <i className="seg signups" style={{ flex: d.signups }} />
                  <i className="seg free" style={{ flex: d.free }} />
                  <i className="seg paid" style={{ flex: d.paid }} />
                  <i className="seg sponsors" style={{ flex: d.sponsors }} />
                </div>
                <span>{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i className="seg signups" /> Accounts
          </span>
          <span>
            <i className="seg free" /> Free listings
          </span>
          <span>
            <i className="seg paid" /> Paid listings
          </span>
          <span>
            <i className="seg sponsors" /> Sponsorships
          </span>
        </div>
        <div className="table-scroll">
          <table className="admin-table stats">
            <thead>
              <tr>
                <th>Date</th>
                <th>Accounts</th>
                <th>Free</th>
                <th>Paid</th>
                <th>Sponsorships</th>
              </tr>
            </thead>
            <tbody>
              {[...data.series].reverse().map((d) => (
                <tr key={d.date}>
                  <th scope="row">{d.date}</th>
                  <td>{d.signups}</td>
                  <td>{d.free}</td>
                  <td>{d.paid}</td>
                  <td>{d.sponsors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Demo data for your account</h2>
          <p>
            Creates, in the account you are signed in with, a real published
            listing (the directory’s own MCP server, put through the Agentic
            Protocol check and published free), an unpublished draft, and a
            test-mode sponsorship that lands in the approval queue. Then open
            your dashboard to see what a sponsor or publisher sees. Safe to run
            again; “Remove” deletes all three.
          </p>
        </div>
        <form action={seedDemo} className="admin-actions">
          <button className="button primary" name="mode" value="create">
            Create demo data
          </button>
          <button className="button secondary" name="mode" value="remove">
            Remove demo data
          </button>
          <Link href="/dashboard" className="button">
            Open your dashboard →
          </Link>
        </form>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Admin log</h2>
        </div>
        {log.length ? (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {log.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">
                      {a.created_at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td>{a.actor}</td>
                    <td className="mono">{a.action}</td>
                    <td className="mono">{a.target}</td>
                    <td>{a.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No admin actions yet.</p>
        )}
      </section>
    </>
  );
}
