import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { categories } from '@/lib/categories';
import {
  ALL_CATEGORIES,
  FORK_OPTIONS,
  LAUNCH_OPTIONS,
  PRICING_OPTIONS,
  STAR_OPTIONS,
  activeFilterCount,
  paramsFromFilters,
  type BrowseFilters,
} from '@/lib/browse';
import {
  compact,
  pace,
  PACE_MIN_DAYS,
  PACE_MIN_STARS,
  rankModes,
  type RankBy,
  type RankedListing,
} from '@/lib/leaderboard';

const day = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '—';
const month = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : '—';

/** One ranked table. Every number is the public GitHub figure the metrics
 *  cron collected; the page states when. */
export function LeaderboardTable({
  items,
  by = 'stars',
}: {
  items: RankedListing[];
  by?: RankBy;
}) {
  if (!items.length)
    return (
      <p className="muted">
        {by === 'pace'
          ? `No ranked listings yet. The pace board needs repositories at least ${PACE_MIN_DAYS} days old with ${PACE_MIN_STARS} or more stars and a known creation date.`
          : 'No ranked listings yet. Listings rank once their public GitHub repository has been read.'}
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
            {by === 'pace' ? (
              <>
                <th scope="col">Stars / day</th>
                <th scope="col">Stars</th>
                <th scope="col">Since</th>
              </>
            ) : (
              <>
                <th scope="col">Stars</th>
                <th scope="col">Forks</th>
                <th scope="col">Last push</th>
              </>
            )}
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
              {by === 'pace' ? (
                <>
                  <td>{pace(item.starsPerDay)}</td>
                  <td title={item.stars.toLocaleString('en-US')}>
                    {compact(item.stars)}
                  </td>
                  <td>{month(item.createdAt)}</td>
                </>
              ) : (
                <>
                  <td title={item.stars.toLocaleString('en-US')}>
                    {compact(item.stars)}
                  </td>
                  <td title={item.forks.toLocaleString('en-US')}>
                    {compact(item.forks)}
                  </td>
                  <td>{day(item.pushedAt)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/** Board tabs on the left, the one-line method in the middle and the update
 *  time on the right. `base` is the page path the tabs link to. */
export function LeaderboardMethod({
  collected,
  base,
  by = 'stars',
  filters,
}: {
  collected: string | null;
  base: string;
  by?: RankBy;
  filters?: BrowseFilters;
}) {
  const tabHref = (mode: RankBy) => {
    const p = filters ? paramsFromFilters(filters) : new URLSearchParams();
    p.delete('kind');
    p.delete('q');
    p.delete('sort');
    if (mode !== 'stars') p.set('by', mode);
    const query = p.toString();
    return query ? `${base}?${query}` : base;
  };
  return (
    <div className="leaderboard-bar">
      <nav className="leaderboard-tabs" aria-label="Ranking">
        {rankModes.map((mode) => (
          <Link
            key={mode.by}
            href={tabHref(mode.by)}
            aria-current={mode.by === by ? 'page' : undefined}
          >
            {mode.label}
          </Link>
        ))}
      </nav>
      <p className="muted">
        {by === 'pace'
          ? `Ranked by public GitHub stars per day since the repository was created. Repositories under ${PACE_MIN_DAYS} days old or ${PACE_MIN_STARS} stars are not ranked.`
          : 'Ranked by public GitHub stars.'}
      </p>
      <span className="status-pill leaderboard-updated">
        {collected ? `Updated ${day(collected)}` : 'First update pending'}
      </span>
    </div>
  );
}

const select = (
  name: string,
  label: string,
  value: string,
  options: readonly (readonly [string, string])[],
) => (
  <label className="leaderboard-filter">
    <span>{label}</span>
    <span className="input-shell">
      <select name={name} defaultValue={value}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </span>
  </label>
);
/** Narrows a board with the same choices as the browse pages. A plain GET
 *  form, so every filtered board has an address of its own. */
export function LeaderboardFilters({
  base,
  by,
  filters,
}: {
  base: string;
  by: RankBy;
  filters: BrowseFilters;
}) {
  const active = activeFilterCount(filters);
  return (
    <form method="get" action={base} className="leaderboard-filters">
      {by !== 'stars' && <input type="hidden" name="by" value={by} />}
      {select('category', 'Category', filters.category, [
        [ALL_CATEGORIES, 'All categories'],
        ...categories.map((c) => [c.name, c.name] as const),
      ])}
      {select('launched', 'Launched', filters.launched, LAUNCH_OPTIONS)}
      {select('stars', 'Stars', filters.stars, STAR_OPTIONS)}
      {select('forks', 'Forks', filters.forks, FORK_OPTIONS)}
      {select('pricing', 'Pricing', filters.pricing, PRICING_OPTIONS)}
      <label className="leaderboard-filter leaderboard-check">
        <input
          type="checkbox"
          name="verified"
          value="1"
          defaultChecked={filters.verified}
        />
        <span>Agentic Protocol checked</span>
      </label>
      <button type="submit" className="button">
        Apply
      </button>
      {active > 0 && (
        <Link
          href={by === 'stars' ? base : `${base}?by=${by}`}
          className="text-link"
        >
          Clear {active} filter{active === 1 ? '' : 's'}
        </Link>
      )}
    </form>
  );
}
