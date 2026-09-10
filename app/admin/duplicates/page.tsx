import Link from 'next/link';
import {
  duplicateTablesReady,
  openDuplicateGroups,
} from '@/lib/server/duplicates';
import { submissionRows } from '@/lib/server/admin';
import ConfirmSubmit from '@/components/confirm-submit';
import { keepDuplicates, mergeDuplicates } from '../actions';
const notices: Record<string, string> = {
  merged: 'Merged. The old address now redirects to the listing you kept.',
  kept: 'Recorded as different projects.',
  failed: 'That change could not be saved. Check the migration and try again.',
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const [groups, ready, submissions] = await Promise.all([
    openDuplicateGroups(),
    duplicateTablesReady(),
    submissionRows().catch(() => []),
  ]);
  const owner = new Map(
    submissions.filter((s) => s.slug).map((s) => [s.slug!, s.owner_email]),
  );
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>
          Possible duplicates <b>{groups.length}</b>
        </h2>
        <p>
          Listings that share a homepage or repository. Merging hides one and
          redirects its address to the one you keep; nothing is deleted. A
          listing verified through the publication checker already replaces
          imported entries on its own.
        </p>
        {!ready && (
          <p className="notice warning">
            Merging and dismissing need migration 202609080008_duplicates.sql
            applied in the Supabase SQL editor.
          </p>
        )}
        {notice && notices[notice] && (
          <p
            className={'notice ' + (notice === 'failed' ? 'error' : 'success')}
          >
            {notices[notice]}
          </p>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="muted">No open duplicates.</p>
      ) : (
        groups.map((group) => (
          <article className="admin-card queue" key={group.key}>
            <div className="admin-card-head">
              <h3>
                {group.items.length} listings
                <small> · {group.key}</small>
              </h3>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Source</th>
                  <th>Owner</th>
                  <th>Homepage</th>
                  <th>Keep</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.slug}>
                    <td>
                      <Link href={'/tools/' + item.slug} target="_blank">
                        {item.name}
                      </Link>
                      <br />
                      <small>{item.slug}</small>
                    </td>
                    <td>
                      {item.source}
                      {item.agenticCheckedAt ? ' · verified' : ''}
                      {item.submitted && !item.agenticCheckedAt
                        ? ' · paid'
                        : ''}
                    </td>
                    <td>
                      {owner.get(item.slug) ??
                        (item.submitted ? '—' : 'import')}
                    </td>
                    <td>
                      <small>{item.homepage}</small>
                    </td>
                    {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the button inside carries its own label */}
                    <td>
                      <form
                        action={mergeDuplicates}
                        className="admin-actions inline"
                      >
                        <input type="hidden" name="winner" value={item.slug} />
                        <input
                          type="hidden"
                          name="losers"
                          value={group.items
                            .filter((i) => i.slug !== item.slug)
                            .map((i) => i.slug)
                            .join(',')}
                        />
                        <ConfirmSubmit
                          className="button"
                          message={`Keep "${item.name}" and merge the other ${group.items.length - 1} into it? Their addresses will redirect here.`}
                        >
                          Keep this one
                        </ConfirmSubmit>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={keepDuplicates} className="admin-actions">
              <input
                type="hidden"
                name="slugs"
                value={group.items.map((i) => i.slug).join(',')}
              />
              <input
                name="note"
                placeholder="Why they are different (optional)"
              />
              <button type="submit" className="button">
                Keep all as different projects
              </button>
            </form>
          </article>
        ))
      )}
    </section>
  );
}
