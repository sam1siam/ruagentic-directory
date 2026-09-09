import { outboxRows } from '@/lib/server/admin';
import { retryEmail } from '../actions';
const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
export default async function Page() {
  const rows = await outboxRows();
  const problems = rows.filter((m) =>
    ['failed', 'uncertain'].includes(m.state),
  );
  const configured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM,
  );
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>
          Listing confirmation emails <b>{rows.length}</b>
        </h2>
        <p>
          {problems.length} need attention · provider{' '}
          {configured ? 'configured' : <strong>not configured</strong>} ·
          sponsorship emails are sent directly and do not appear here.
        </p>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Queued</th>
                <th>Recipient</th>
                <th>Listing</th>
                <th>State</th>
                <th>Attempts</th>
                <th>Last error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{when(m.created_at)}</td>
                  <td>{m.recipient}</td>
                  <td>
                    {m.payload?.name ?? '—'}
                    <br />
                    <small className="mono">{m.payload?.method}</small>
                  </td>
                  <td>
                    <span
                      className={
                        'badge ' +
                        (m.state === 'sent'
                          ? 'approved'
                          : m.state === 'pending' || m.state === 'sending'
                            ? 'pending'
                            : 'rejected')
                      }
                    >
                      {m.state}
                    </span>
                  </td>
                  <td className="mono">{m.attempts}</td>
                  <td>
                    <small>{m.last_error ?? ''}</small>
                  </td>
                  <td>
                    {['failed', 'uncertain'].includes(m.state) && (
                      <form
                        action={retryEmail}
                        className="admin-actions inline"
                      >
                        <input type="hidden" name="email" value={m.id} />
                        <button className="button" name="retry" value="1">
                          Retry
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No confirmation emails have been queued yet.</p>
      )}
    </section>
  );
}
