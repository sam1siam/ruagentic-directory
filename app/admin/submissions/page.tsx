import Link from 'next/link';
import { since, submissionRows, startOfToday } from '@/lib/server/admin';
import { setListingState } from '../actions';
const ranges = [
  ['today', 'Today'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['all', 'All time'],
] as const;
const methods = [
  ['all', 'All'],
  ['agentic', 'Free (Agentic Protocol)'],
  ['payment', 'Paid'],
  ['none', 'Not published'],
] as const;
const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; method?: string }>;
}) {
  const p = await searchParams;
  const range = ranges.some(([r]) => r === p.range) ? p.range! : '7';
  const method = methods.some(([m]) => m === p.method) ? p.method! : 'all';
  const from =
    range === 'today'
      ? startOfToday()
      : range === 'all'
        ? ''
        : since(Number(range));
  const rows = (await submissionRows()).filter(
    (s) =>
      (!from || s.created_at >= from || (s.published_at ?? '') >= from) &&
      (method === 'all' ||
        (method === 'none' ? !s.method : s.method === method)),
  );
  const href = (r: string, m: string) =>
    '/admin/submissions?range=' + r + '&method=' + m;
  const counts = {
    free: rows.filter((s) => s.method === 'agentic').length,
    paid: rows.filter((s) => s.method === 'payment').length,
    none: rows.filter((s) => !s.method).length,
  };
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>
          Submissions <b>{rows.length}</b>
        </h2>
        <p>
          {counts.free} free via Agentic Protocol · {counts.paid} paid ·{' '}
          {counts.none} not published
        </p>
        <nav className="range-picker" aria-label="Range">
          {ranges.map(([r, label]) => (
            <Link
              key={r}
              href={href(r, method)}
              aria-current={r === range ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <nav className="range-picker" aria-label="Publication route">
          {methods.map(([m, label]) => (
            <Link
              key={m}
              href={href(range, m)}
              aria-current={m === method ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Route</th>
                <th>State</th>
                <th>Owner</th>
                <th>Started</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <br />
                    <small className="mono">
                      {s.kind}
                      {s.slug && (
                        <>
                          {' · '}
                          <Link href={'/tools/' + s.slug}>/tools/{s.slug}</Link>
                        </>
                      )}
                    </small>
                  </td>
                  <td>
                    {s.method === 'agentic' ? (
                      <span className="badge approved">free · protocol</span>
                    ) : s.method === 'payment' ? (
                      <span className="badge paid">paid</span>
                    ) : (
                      <span className="badge pending">not published</span>
                    )}
                  </td>
                  <td>
                    <span className={'badge status ' + s.state}>{s.state}</span>
                    {s.visible === false && s.state === 'published' && (
                      <span className="badge test">hidden</span>
                    )}
                  </td>
                  <td>
                    {s.owner_email ? (
                      <a href={'mailto:' + s.owner_email}>{s.owner_email}</a>
                    ) : (
                      <em>unknown</em>
                    )}
                  </td>
                  <td className="mono">{when(s.created_at)}</td>
                  <td className="mono">{when(s.published_at)}</td>
                  <td>
                    <form
                      action={setListingState}
                      className="admin-actions inline"
                    >
                      <input type="hidden" name="submission" value={s.id} />
                      {s.state === 'suspended' ? (
                        <button
                          className="button"
                          name="action"
                          value="restore"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          className="button secondary"
                          name="action"
                          value="suspend"
                        >
                          Suspend
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No submissions in this range.</p>
      )}
    </section>
  );
}
