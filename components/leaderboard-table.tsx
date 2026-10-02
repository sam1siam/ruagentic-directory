import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { compact, type RankedListing } from '@/lib/leaderboard';

const day = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

/** One ranked table. Every number is the public GitHub figure the metrics
 *  cron collected; the page states when. */
export function LeaderboardTable({ items }: { items: RankedListing[] }) {
  if (!items.length)
    return (
      <p className="muted">
        No ranked listings yet. Listings rank once their public GitHub
        repository has been read.
      </p>
    );
  return (
    <div className="table-scroll">
      <table className="compare-table leaderboard-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Listing</th>
            <th scope="col">Category</th>
            <th scope="col">Stars</th>
            <th scope="col">Forks</th>
            <th scope="col">Last push</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.slug}>
              <td>{item.rank}</td>
              <td>
                <Link href={'/tools/' + item.slug}>{item.name}</Link>
                {item.verified && (
                  <span
                    className="verified-mark"
                    title="Agentic Protocol files checked"
                  >
                    {' '}
                    <CheckCircle2 size={14} aria-hidden="true" />
                  </span>
                )}
                <br />
                <small>{item.summary}</small>
                {item.siblings > 0 && (
                  <small className="muted">
                    +{item.siblings} more from this repository
                  </small>
                )}
              </td>
              <td>{item.category}</td>
              <td title={item.stars.toLocaleString('en-US')}>
                {compact(item.stars)}
              </td>
              <td title={item.forks.toLocaleString('en-US')}>
                {compact(item.forks)}
              </td>
              <td>{day(item.pushedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/** The ranking signal on the left and when it was last updated on the right. */
export function LeaderboardMethod({ collected }: { collected: string | null }) {
  return (
    <div className="leaderboard-bar">
      <p className="muted">Ranked by public GitHub stars.</p>
      <span className="status-pill leaderboard-updated">
        {collected ? `Updated ${day(collected)}` : 'First update pending'}
      </span>
    </div>
  );
}
