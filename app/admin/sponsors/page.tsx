import Link from 'next/link';
import { adOrders, orderAmount, type AdOrder } from '@/lib/server/admin';
import {
  formatUsd,
  parseCategories,
  placementById,
  sponsorHref,
} from '@/lib/advertising';
import { categoryBySlug } from '@/lib/categories';
import { reviewSponsor } from '../actions';
const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') + ' UTC' : '—';
function Order({ order, queue }: { order: AdOrder; queue: boolean }) {
  const placement = placementById(order.placement);
  const cats = parseCategories(order.categories)
    .map((s) => categoryBySlug(s)?.name ?? s)
    .join(', ');
  return (
    <article className={'admin-card' + (queue ? ' queue' : '')}>
      <header className="admin-card-head">
        <div>
          <span className={'badge ' + order.approval}>{order.approval}</span>
          <span className={'badge status ' + order.status}>{order.status}</span>
          {!order.livemode && <span className="badge test">test mode</span>}
        </div>
        <span className="mono">{when(order.created_at)}</span>
      </header>
      <h3>
        {order.product}{' '}
        <small>
          {placement?.name ?? order.placement} · {formatUsd(orderAmount(order))}
          /month
        </small>
      </h3>
      <dl className="admin-fields">
        <div>
          <dt>Tagline (top bar)</dt>
          <dd>{order.tagline}</dd>
        </div>
        <div>
          <dt>Card description</dt>
          <dd>{order.description || <em>none (bar only)</em>}</dd>
        </div>
        <div>
          <dt>Button label</dt>
          <dd>{order.cta || <em>default</em>}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{cats || <em>none (bar only)</em>}</dd>
        </div>
        <div>
          <dt>Target URL</dt>
          <dd>
            <a
              href={sponsorHref(order.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {order.url}
            </a>
          </dd>
        </div>
        <div>
          <dt>Sponsor page</dt>
          <dd>
            <Link href={'/sponsors/' + encodeURIComponent(order.slug)}>
              /sponsors/{order.slug}
            </Link>{' '}
            <small>(shows once approved and active)</small>
          </dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd>
            {order.customer_email ? (
              <a href={'mailto:' + order.customer_email}>
                {order.customer_email}
              </a>
            ) : (
              <em>no email on the session</em>
            )}
          </dd>
        </div>
        <div>
          <dt>Stripe</dt>
          <dd className="mono">
            session {order.stripe_session_id}
            <br />
            subscription {order.stripe_subscription_id ?? '—'}
            <br />
            customer {order.stripe_customer_id ?? '—'}
          </dd>
        </div>
        {order.reviewed_at && (
          <div>
            <dt>Reviewed</dt>
            <dd>
              {when(order.reviewed_at)} by {order.reviewed_by}
              {order.review_note && <> · {order.review_note}</>}
            </dd>
          </div>
        )}
      </dl>
      {order.pending && order.approval === 'approved' && (
        <div className="pending-changes">
          <strong>Changes awaiting review</strong>
          <dl className="admin-fields">
            {(
              [
                ['Tagline', order.tagline, order.pending.tagline],
                [
                  'Card description',
                  order.description,
                  order.pending.description,
                ],
                ['Button label', order.cta, order.pending.cta],
                [
                  'Categories',
                  cats,
                  order.pending.categories
                    .map((s) => categoryBySlug(s)?.name ?? s)
                    .join(', '),
                ],
              ] as const
            )
              .filter(([, before, after]) => before !== after)
              .map(([label, before, after]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <s>{before || '—'}</s>
                    <br />
                    {after || '—'}
                  </dd>
                </div>
              ))}
          </dl>
          <p className="muted">
            Approve applies these to the live creative and adjusts the
            subscription’s extra-category line with proration. Reject drops them
            and keeps the live creative; the note is emailed.
          </p>
        </div>
      )}
      <form action={reviewSponsor} className="admin-actions">
        <input type="hidden" name="session" value={order.stripe_session_id} />
        <input
          name="note"
          maxLength={500}
          placeholder="Note to the sponsor (sent with a rejection) or for the log"
          defaultValue={order.review_note}
        />
        {(order.approval !== 'approved' || order.pending) && (
          <button className="button primary" name="decision" value="approved">
            {order.pending && order.approval === 'approved'
              ? 'Approve changes'
              : 'Approve · go live'}
          </button>
        )}
        {(order.approval !== 'rejected' || order.pending) && (
          <button className="button secondary" name="decision" value="rejected">
            {order.pending && order.approval === 'approved'
              ? 'Reject changes'
              : 'Reject'}
          </button>
        )}
        {order.approval !== 'pending' && !order.pending && (
          <button className="button" name="decision" value="pending">
            Back to queue
          </button>
        )}
      </form>
      {order.approval === 'rejected' && (
        <p className="muted">
          A rejected sponsor keeps paying until the subscription is cancelled.
          Cancel or refund it in the Stripe dashboard (subscription{' '}
          <code>{order.stripe_subscription_id ?? '—'}</code>).
        </p>
      )}
    </article>
  );
}
export default async function Page() {
  const orders = await adOrders();
  const queue = orders.filter(
    (o) =>
      o.status === 'active' &&
      (o.approval === 'pending' || (o.pending && o.approval === 'approved')),
  );
  const rest = orders.filter((o) => !queue.includes(o));
  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            Awaiting approval <b>{queue.length}</b>
          </h2>
          <p>
            Sponsors are told to expect a decision within 24–48 hours. Approving
            makes the placement render immediately; rejecting emails the note
            below to the sponsor.
          </p>
        </div>
        {queue.length ? (
          queue.map((o) => <Order key={o.stripe_session_id} order={o} queue />)
        ) : (
          <p className="muted">Nothing waiting. New paid orders appear here.</p>
        )}
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            All orders <b>{rest.length}</b>
          </h2>
        </div>
        {rest.length ? (
          rest.map((o) => (
            <Order key={o.stripe_session_id} order={o} queue={false} />
          ))
        ) : (
          <p className="muted">No other orders yet.</p>
        )}
      </section>
    </>
  );
}
