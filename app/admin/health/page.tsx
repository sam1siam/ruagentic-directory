import Link from 'next/link';
import { adminClient } from '@/lib/supabase/server';
import { bundledCatalog } from '@/lib/server/catalog';
import { hideListing, recheckListing, runHealthNow } from '../actions';
type Check = {
  slug: string;
  checked_at: string;
  status: 'ok' | 'warn' | 'broken';
  issues: { code: string; detail: string }[];
  links: Record<string, { url: string; status: number }>;
};
type Override = {
  slug: string;
  hidden: boolean;
  note: string;
  updated_at: string;
};
const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const db = adminClient();
  const [items, checks, overrides] = await Promise.all([
    bundledCatalog(),
    db
      .from('listing_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(2000),
    db
      .from('catalog_overrides')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(2000),
  ]);
  if (checks.error || overrides.error)
    return (
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Data health</h2>
          <p>
            This tab needs migration 202609080007_listing_health.sql applied in
            the Supabase SQL editor. Storage answered:{' '}
            {(checks.error ?? overrides.error)!.message}
          </p>
        </div>
      </section>
    );
  const bySlug = new Map((checks.data as Check[]).map((c) => [c.slug, c]));
  const hidden = new Map(
    (overrides.data as Override[]).map((o) => [o.slug, o]),
  );
  const name = new Map(items.map((i) => [i.slug, i.name]));
  const counts = { ok: 0, warn: 0, broken: 0, unchecked: 0 };
  for (const i of items) {
    const c = bySlug.get(i.slug);
    if (!c) counts.unchecked++;
    else counts[c.status]++;
  }
  const attention = (checks.data as Check[])
    .filter((c) => c.status !== 'ok' && name.has(c.slug))
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === 'broken' ? -1 : 1,
    );
  const hiddenRows = [...hidden.values()].filter((o) => o.hidden);
  return (
    <>
      {notice && <output className="notice">{notice.slice(0, 600)}</output>}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Data health</h2>
          <p>
            A scheduled check visits every bundled listing&rsquo;s homepage,
            documentation, repository, MCP endpoint and registry record in
            batches of 40 every three hours, so the whole catalog is re-verified
            about every two days. Nothing is hidden automatically; broken and
            warning rows wait here for you. Hiding removes a listing from the
            directory without a deploy; fixing the underlying data still happens
            in the repository&rsquo;s catalog file.
          </p>
        </div>
        <div className="kpi-grid">
          <div className="kpi">
            <span>Checked ok</span>
            <b>{counts.ok}</b>
          </div>
          <div className="kpi highlight">
            <span>Broken</span>
            <b>{counts.broken}</b>
            <small>dead homepage or repository</small>
          </div>
          <div className="kpi">
            <span>Warnings</span>
            <b>{counts.warn}</b>
            <small>
              docs, endpoint, stale or archived repo, registry drift
            </small>
          </div>
          <div className="kpi">
            <span>Not checked yet</span>
            <b>{counts.unchecked}</b>
          </div>
          <div className="kpi">
            <span>Hidden by you</span>
            <b>{hiddenRows.length}</b>
          </div>
        </div>
        <form
          action={runHealthNow}
          className="admin-actions"
          style={{ marginTop: 14 }}
        >
          <button className="button" name="run" value="1">
            Check the next 20 now
          </button>
        </form>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            Needs attention <b>{attention.length}</b>
          </h2>
        </div>
        {attention.length ? (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Status</th>
                  <th>Issues</th>
                  <th>Checked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((c) => {
                  const o = hidden.get(c.slug);
                  return (
                    <tr key={c.slug}>
                      <td>
                        <strong>{name.get(c.slug)}</strong>
                        <br />
                        <small className="mono">
                          <Link href={'/tools/' + c.slug}>/tools/{c.slug}</Link>
                        </small>
                      </td>
                      <td>
                        <span
                          className={
                            'badge ' +
                            (c.status === 'broken' ? 'rejected' : 'pending')
                          }
                        >
                          {c.status}
                        </span>
                        {o?.hidden && (
                          <span className="badge test">hidden</span>
                        )}
                      </td>
                      <td>
                        <ul className="issue-list">
                          {c.issues.map((i) => (
                            <li key={i.code + i.detail}>
                              <code>{i.code}</code> {i.detail}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="mono">{when(c.checked_at)}</td>
                      {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the buttons inside carry their own labels */}
                      <td>
                        <div className="admin-actions">
                          <form
                            action={recheckListing}
                            className="admin-actions inline"
                          >
                            <input type="hidden" name="slug" value={c.slug} />
                            <button className="button" type="submit">
                              Recheck
                            </button>
                          </form>
                          <form
                            action={hideListing}
                            className="admin-actions inline"
                          >
                            <input type="hidden" name="slug" value={c.slug} />
                            <button
                              className="button secondary"
                              type="submit"
                              name="hidden"
                              value={o?.hidden ? 'false' : 'true'}
                            >
                              {o?.hidden ? 'Show' : 'Hide'}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Nothing flagged. Checks appear here as batches run.
          </p>
        )}
      </section>
      {hiddenRows.length > 0 && (
        <section className="admin-section">
          <div className="admin-section-head">
            <h2>
              Hidden listings <b>{hiddenRows.length}</b>
            </h2>
          </div>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Note</th>
                  <th>Since</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hiddenRows.map((o) => (
                  <tr key={o.slug}>
                    <td>
                      <strong>{name.get(o.slug) ?? o.slug}</strong>
                      <br />
                      <small className="mono">/tools/{o.slug}</small>
                    </td>
                    <td>{o.note}</td>
                    <td className="mono">{when(o.updated_at)}</td>
                    {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the buttons inside carry their own labels */}
                    <td>
                      <div className="admin-actions">
                        <form
                          action={hideListing}
                          className="admin-actions inline"
                        >
                          <input type="hidden" name="slug" value={o.slug} />
                          <button
                            className="button"
                            type="submit"
                            name="hidden"
                            value="false"
                          >
                            Show again
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
