'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Megaphone, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/client-api';
import {
  categoryExtraAmount,
  formatUsd,
  includesCard,
  quote,
  type CreativeEdit,
  type PlacementId,
} from '@/lib/advertising';
import { categories, categoryBySlug } from '@/lib/categories';

export type SponsorshipView = {
  session: string;
  product: string;
  placement: PlacementId;
  placementName: string;
  categories: string[];
  approval: string;
  status: string;
  livemode: boolean;
  page: string;
  tagline: string;
  description: string;
  cta: string;
  url: string;
  pending: CreativeEdit | null;
  monthly: string;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};
const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
function stateLabel(o: SponsorshipView) {
  if (o.status === 'canceled') return ['Cancelled', 'rejected'];
  if (o.status === 'past_due') return ['Payment past due', 'rejected'];
  if (o.status === 'incomplete') return ['Awaiting payment', 'pending'];
  if (o.approval === 'rejected') return ['Not approved', 'rejected'];
  if (o.approval === 'pending') return ['In review', 'pending'];
  if (o.cancelAtPeriodEnd)
    return ['Live · cancels ' + date(o.renewsAt), 'pending'];
  return ['Live', 'approved'];
}
function EditForm({
  order,
  onSaved,
  onCancel,
}: {
  order: SponsorshipView;
  onSaved: (result: string, edit: CreativeEdit) => void;
  onCancel: () => void;
}) {
  const base = order.pending ?? order;
  const [tagline, setTagline] = useState(base.tagline),
    [description, setDescription] = useState(base.description),
    [cta, setCta] = useState(base.cta),
    [chosen, setChosen] = useState<string[]>(base.categories),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const card = includesCard(order.placement);
  const total = quote(order.placement, chosen);
  return (
    <form
      className="sponsorship-edit"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
          const edit = {
            tagline,
            description: card ? description : '',
            cta: card ? cta : '',
            categories: card ? chosen : [],
          };
          const { result } = await api('/api/sponsorships/creative', {
            session: order.session,
            ...edit,
          });
          onSaved(result, edit);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <div className="field full">
          <label htmlFor={'tag-' + order.session} className="input-label">
            Tagline <b>· {tagline.length}/120</b>
          </label>
          <div className="input-shell">
            <input
              id={'tag-' + order.session}
              required
              minLength={10}
              maxLength={120}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
        </div>
        {card && (
          <>
            <div className="field full">
              <label htmlFor={'desc-' + order.session} className="input-label">
                Card description <b>· {description.length}/200</b>
              </label>
              <div className="input-shell">
                <textarea
                  id={'desc-' + order.session}
                  required
                  minLength={20}
                  maxLength={200}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor={'cta-' + order.session} className="input-label">
                Button label <b>· optional</b>
              </label>
              <div className="input-shell">
                <input
                  id={'cta-' + order.session}
                  maxLength={24}
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Learn more"
                />
              </div>
            </div>
            <fieldset className="category-picker full">
              <legend className="input-label">
                Categories{' '}
                <b>
                  · one included, +{formatUsd(categoryExtraAmount)} each extra
                </b>
              </legend>
              {categories.map((c) => {
                const on = chosen.includes(c.slug);
                return (
                  <label
                    key={c.slug}
                    className={'category-option' + (on ? ' is-on' : '')}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setChosen((list) =>
                          on
                            ? list.filter((s) => s !== c.slug)
                            : [...list, c.slug],
                        )
                      }
                    />
                    <span className="category-option-name">{c.name}</span>
                  </label>
                );
              })}
            </fieldset>
          </>
        )}
      </div>
      <p className="muted">
        New monthly total once approved: <b>{total.display}</b>. Changes are
        reviewed within 24–48 hours; your current creative stays live until
        then, and category changes are billed with proration from approval.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button type="submit" className="button primary" disabled={busy}>
          {busy && <LoaderCircle size={14} className="spin" />}
          Send for review →
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export default function SponsorshipsPanel({
  orders,
}: {
  orders: SponsorshipView[];
}) {
  const [rows, setRows] = useState(orders),
    [editing, setEditing] = useState<string | null>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState('');
  async function openPortal(session: string) {
    setBusy(session);
    setError('');
    try {
      const { url } = await api('/api/sponsorships/portal', { session });
      window.location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }
  return (
    <section className="sponsorships">
      <h2>
        <Megaphone size={21} />
        Your sponsorships
      </h2>
      {notice && <div className="notice">{notice}</div>}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {rows.length ? (
        <div className="sponsorship-list">
          {rows.map((o) => {
            const [label, tone] = stateLabel(o);
            return (
              <article className="sponsorship-card glass" key={o.session}>
                <header>
                  <div>
                    <span className={'badge ' + tone}>{label}</span>
                    {!o.livemode && (
                      <span className="badge test">test mode</span>
                    )}
                    {o.pending && (
                      <span className="badge pending">changes in review</span>
                    )}
                  </div>
                  <span className="mono">{o.monthly}/month</span>
                </header>
                <h3>
                  {o.product}
                  <small>{o.placementName}</small>
                </h3>
                <dl className="admin-fields">
                  <div>
                    <dt>Tagline</dt>
                    <dd>{o.tagline}</dd>
                  </div>
                  {includesCard(o.placement) && (
                    <>
                      <div>
                        <dt>Card description</dt>
                        <dd>{o.description}</dd>
                      </div>
                      <div>
                        <dt>Categories</dt>
                        <dd>
                          {o.categories
                            .map((s) => categoryBySlug(s)?.name ?? s)
                            .join(', ')}
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Links to</dt>
                    <dd>{o.url}</dd>
                  </div>
                  <div>
                    <dt>{o.cancelAtPeriodEnd ? 'Ends' : 'Renews'}</dt>
                    <dd>{date(o.renewsAt) || 'See billing'}</dd>
                  </div>
                </dl>
                {o.pending && (
                  <p className="muted">
                    Pending changes: “{o.pending.tagline}”
                    {o.pending.categories.length
                      ? ' · ' +
                        o.pending.categories
                          .map((s) => categoryBySlug(s)?.name ?? s)
                          .join(', ')
                      : ''}
                    . We review within 24–48 hours.
                  </p>
                )}
                {o.approval === 'pending' && o.status === 'active' && (
                  <p className="muted">
                    We review every creative within 24–48 hours and email you
                    when it goes live.
                  </p>
                )}
                {editing === o.session ? (
                  <EditForm
                    order={o}
                    onCancel={() => setEditing(null)}
                    onSaved={(result, edit) => {
                      setEditing(null);
                      setRows((list) =>
                        list.map((r) =>
                          r.session !== o.session
                            ? r
                            : result === 'pending-review'
                              ? { ...r, pending: edit }
                              : {
                                  ...r,
                                  ...edit,
                                  pending: null,
                                  approval: 'pending',
                                },
                        ),
                      );
                      setNotice(
                        result === 'pending-review'
                          ? 'Your changes are in review. The current creative stays live until they are approved.'
                          : 'Your creative was updated and is in review.',
                      );
                    }}
                  />
                ) : (
                  <div className="actions">
                    {o.status !== 'canceled' && (
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => setEditing(o.session)}
                      >
                        Edit creative
                      </button>
                    )}
                    <button
                      type="button"
                      className="button"
                      disabled={busy === o.session}
                      onClick={() => openPortal(o.session)}
                    >
                      {busy === o.session && (
                        <LoaderCircle size={14} className="spin" />
                      )}
                      Manage billing
                    </button>
                    {o.approval === 'approved' &&
                      o.status === 'active' &&
                      includesCard(o.placement) && (
                        <Link href={o.page} className="button">
                          View sponsor page
                        </Link>
                      )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <p>No sponsorships yet. Placements start at US$499 a month.</p>
        </div>
      )}
      <p className="muted">
        Manage billing opens Stripe’s secure portal to update your card,
        download invoices or cancel; a cancelled placement stays live until the
        end of the paid period.{' '}
        <Link href="/advertise" className="text-link">
          Buy another placement ↗
        </Link>
      </p>
    </section>
  );
}
