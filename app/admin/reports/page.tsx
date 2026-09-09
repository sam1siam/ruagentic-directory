import Link from 'next/link';
import { reportRows } from '@/lib/server/admin';
import { resolveReport } from '../actions';
const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
export default async function Page() {
  const rows = await reportRows();
  const open = rows.filter((r) => r.state === 'open');
  const closed = rows.filter((r) => r.state !== 'open');
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <article className={'admin-card' + (r.state === 'open' ? ' queue' : '')}>
      <header className="admin-card-head">
        <div>
          <span
            className={
              'badge ' +
              (r.state === 'open'
                ? 'pending'
                : r.state === 'resolved'
                  ? 'approved'
                  : 'rejected')
            }
          >
            {r.state}
          </span>
        </div>
        <span className="mono">{when(r.created_at)}</span>
      </header>
      <h3>
        {r.listing_name ?? <em>listing removed</em>}{' '}
        {r.slug && (
          <small>
            <Link href={'/tools/' + r.slug}>/tools/{r.slug}</Link>
          </small>
        )}
      </h3>
      <dl className="admin-fields">
        <div>
          <dt>Reason</dt>
          <dd className="preserve-lines">{r.reason}</dd>
        </div>
        <div>
          <dt>Reported by</dt>
          <dd>
            {r.reporter_email ? (
              <a href={'mailto:' + r.reporter_email}>{r.reporter_email}</a>
            ) : (
              <em>anonymous or deleted account</em>
            )}
          </dd>
        </div>
        {r.resolved_at && (
          <div>
            <dt>Closed</dt>
            <dd>
              {when(r.resolved_at)}
              {r.resolution && <> · {r.resolution}</>}
            </dd>
          </div>
        )}
      </dl>
      <form action={resolveReport} className="admin-actions">
        <input type="hidden" name="report" value={r.id} />
        <input
          name="resolution"
          maxLength={500}
          placeholder="What was done (for the log)"
          defaultValue={r.resolution}
        />
        {r.state !== 'resolved' && (
          <button className="button primary" name="state" value="resolved">
            Mark resolved
          </button>
        )}
        {r.state !== 'dismissed' && (
          <button className="button secondary" name="state" value="dismissed">
            Dismiss
          </button>
        )}
        {r.state !== 'open' && (
          <button className="button" name="state" value="open">
            Reopen
          </button>
        )}
      </form>
      {r.slug && r.state === 'open' && (
        <p className="muted">
          To hide the listing, suspend it from the{' '}
          <Link href="/admin/submissions?range=all">Submissions</Link> tab (user
          listings only; bundled catalog entries are edited in the repository).
        </p>
      )}
    </article>
  );
  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            Open reports <b>{open.length}</b>
          </h2>
        </div>
        {open.length ? (
          open.map((r) => <Row key={r.id} r={r} />)
        ) : (
          <p className="muted">No open reports.</p>
        )}
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            Closed <b>{closed.length}</b>
          </h2>
        </div>
        {closed.length ? (
          closed.map((r) => <Row key={r.id} r={r} />)
        ) : (
          <p className="muted">Nothing closed yet.</p>
        )}
      </section>
    </>
  );
}
