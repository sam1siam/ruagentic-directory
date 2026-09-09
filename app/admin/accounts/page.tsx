import Link from 'next/link';
import {
  allUsers,
  since,
  startOfToday,
  submissionRows,
} from '@/lib/server/admin';
const ranges = [
  ['today', 'Today'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['all', 'All time'],
] as const;
const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: raw } = await searchParams;
  const range = ranges.some(([r]) => r === raw) ? raw! : '30';
  const from =
    range === 'today'
      ? startOfToday()
      : range === 'all'
        ? ''
        : since(Number(range));
  const [users, subs] = await Promise.all([allUsers(), submissionRows()]);
  const rows = users.filter((u) => !from || u.created_at >= from);
  const perOwner = new Map<string, { total: number; published: number }>();
  for (const s of subs) {
    const c = perOwner.get(s.owner_id) ?? { total: 0, published: 0 };
    c.total++;
    if (s.method) c.published++;
    perOwner.set(s.owner_id, c);
  }
  const confirmed = rows.filter((u) => u.email_confirmed_at).length;
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>
          Accounts created <b>{rows.length}</b>
        </h2>
        <p>
          {confirmed} confirmed · {rows.length - confirmed} unconfirmed ·{' '}
          {rows.filter((u) => perOwner.get(u.id)?.published).length} with a
          published listing
        </p>
        <nav className="range-picker" aria-label="Range">
          {ranges.map(([r, label]) => (
            <Link
              key={r}
              href={'/admin/accounts?range=' + r}
              aria-current={r === range ? 'page' : undefined}
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
                <th>Email</th>
                <th>Created</th>
                <th>Confirmed</th>
                <th>Last sign-in</th>
                <th>Provider</th>
                <th>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const c = perOwner.get(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      {u.email ? (
                        <a href={'mailto:' + u.email}>{u.email}</a>
                      ) : (
                        <em>no email</em>
                      )}
                    </td>
                    <td className="mono">{when(u.created_at)}</td>
                    <td>
                      {u.email_confirmed_at ? (
                        <span className="badge approved">confirmed</span>
                      ) : (
                        <span className="badge pending">unconfirmed</span>
                      )}
                    </td>
                    <td className="mono">{when(u.last_sign_in_at)}</td>
                    <td className="mono">{u.provider}</td>
                    <td>
                      {c ? `${c.published} published / ${c.total} total` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No accounts in this range.</p>
      )}
    </section>
  );
}
