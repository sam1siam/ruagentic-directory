'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowUpRight, Bookmark, FolderOpen } from 'lucide-react';
import SignOut from './sign-out';
import { Button } from './ui/button';
import { api } from '@/lib/client-api';
type Row = {
  id: string;
  payload: { name: string; summary: string };
  state: string;
  slug: string | null;
  revision: number;
  updated_at: string;
  hasUnpublishedChanges: boolean;
};
export default function Dashboard({
  email,
  submissions,
  saved,
}: {
  email: string;
  submissions: Row[];
  saved: { slug: string; name: string; summary: string }[];
}) {
  const [rows, setRows] = useState(submissions),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <main className="content-page dashboard-page">
      <div className="page-heading heading-row">
        <div>
          <h1>Your projects.</h1>
          <p>{email}</p>
        </div>
        <div className="actions">
          <SignOut />
          <Link className="button primary" href="/submit">
            <Plus size={16} />
            Submit a project
          </Link>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <section>
        <h2>
          <FolderOpen size={21} />
          Your listings
        </h2>
        {rows.length ? (
          <div className="dashboard-list">
            {rows.map((row) => (
              <article key={row.id}>
                <div>
                  <span className={'status-pill ' + row.state}>
                    {row.state === 'editing'
                      ? 'Saved, not published'
                      : row.state === 'withdrawn'
                        ? 'Unpublished'
                        : row.state}
                    {row.hasUnpublishedChanges && row.state === 'published'
                      ? ' · unpublished changes'
                      : ''}
                  </span>
                  <h3>{row.payload.name}</h3>
                  <p>{row.payload.summary}</p>
                  <small>
                    Updated {new Date(row.updated_at).toLocaleDateString()}
                  </small>
                </div>
                <div className="actions">
                  <Link
                    href={'/submit?id=' + row.id}
                    className="button secondary"
                  >
                    {row.state === 'published' ? 'Manage' : 'Continue'}
                  </Link>
                  {row.slug && row.state === 'published' && (
                    <Link href={'/tools/' + row.slug} className="text-link">
                      View
                      <ArrowUpRight size={15} />
                    </Link>
                  )}
                  {row.state === 'published' && (
                    <Button variant="ghost" onClick={() => setConfirm(row.id)}>
                      Unpublish
                    </Button>
                  )}
                </div>
                {confirm === row.id && (
                  <div className="withdraw-confirm">
                    <p>
                      Remove this listing from the public directory? Your saved
                      information stays in your account and you can publish it
                      again later. This does not refund a payment.
                    </p>
                    <div className="actions">
                      <Button
                        disabled={busy}
                        variant="destructive"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api(
                              '/api/submissions/' + row.id,
                              undefined,
                              'DELETE',
                            );
                            setRows(
                              rows.map((r) =>
                                r.id === row.id
                                  ? { ...r, state: 'withdrawn' }
                                  : r,
                              ),
                            );
                            setConfirm(null);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Unpublish listing
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirm(null)}>
                        Keep published
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FolderOpen size={30} />
            <h3>No submissions yet</h3>
            <p>Add a public project link to start your first listing.</p>
            <Link href="/submit" className="button primary">
              Submit a project
              <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section>
        <h2>
          <Bookmark size={21} />
          Saved tools
        </h2>
        {saved.length ? (
          <div className="related-grid">
            {saved.map((row) => (
              <Link href={'/tools/' + row.slug} key={row.slug}>
                <span className="project-monogram">{row.name.slice(0, 2)}</span>
                <strong>{row.name}</strong>
                <p>{row.summary}</p>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Save tools from their listing pages to find them here.</p>
            <Link className="text-link" href="/">
              Explore the directory ↗
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
