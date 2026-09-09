import Link from 'next/link';
import { adOrders, orderAmount, type AdOrder } from '@/lib/server/admin';
import {
  formatUsd,
  parseCategories,
  placementById,
  sponsorHref,
} from '@/lib/advertising';
import { categoryBySlug } from '@/lib/categories';
import {
  moveSponsor,
  reviewSponsor,
  saveBarSettings,
  toggleSponsorHidden,
} from '../actions';
import { sponsorBarSettings } from '@/lib/server/sponsors';
import ConfirmSubmit from '@/components/confirm-submit';
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
          {order.hidden && <span className="badge rejected">hidden</span>}
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
        {order.pending && order.approval === 'approved' ? (
          <button className="button secondary" name="decision" value="rejected">
            Reject changes
          </button>
        ) : (
          <>
            {order.approval !== 'rejected' && (
              <button
                className="button secondary"
                name="decision"
                value="rejected"
                title="Placement stays off; the sponsor keeps paying and can edit and resend. The note is emailed as what to change."
              >
                Reject · ask to amend
              </button>
            )}
            {order.status !== 'canceled' && order.stripe_subscription_id && (
              <ConfirmSubmit
                className="button secondary"
                name="decision"
                value="refunded"
                message={`Cancel ${order.product}'s subscription and refund its last payment? This cannot be undone.`}
              >
                Reject & refund
              </ConfirmSubmit>
            )}
          </>
        )}
        {order.approval !== 'pending' && !order.pending && (
          <button className="button" name="decision" value="pending">
            Back to queue
          </button>
        )}
      </form>
      {order.approval === 'approved' && order.status === 'active' && (
        <form action={toggleSponsorHidden} className="admin-actions inline">
          <input type="hidden" name="session" value={order.stripe_session_id} />
          <input
            type="hidden"
            name="hidden"
            value={order.hidden ? 'false' : 'true'}
          />
          <button className="button" type="submit">
            {order.hidden ? 'Show everywhere' : 'Hide everywhere'}
          </button>
        </form>
      )}
      {order.approval === 'rejected' && order.status !== 'canceled' && (
        <p className="muted">
          Asked to amend: the subscription stays active and the sponsor can edit
          and resend from their dashboard, which puts the order back in this
          queue. Use Reject & refund to cancel and refund instead (subscription{' '}
          <code>{order.stripe_subscription_id ?? '—'}</code>).
        </p>
      )}
      {order.approval === 'rejected' && order.status === 'canceled' && (
        <p className="muted">Rejected; subscription cancelled and refunded.</p>
      )}
    </article>
  );
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const [orders, bar] = await Promise.all([adOrders(), sponsorBarSettings()]);
  const live = orders
    .filter((o) => o.approval === 'approved' && o.status === 'active')
    .sort(
      (a, b) =>
        (a.position ?? Number.MAX_SAFE_INTEGER) -
          (b.position ?? Number.MAX_SAFE_INTEGER) ||
        b.created_at.localeCompare(a.created_at),
    );
  const queue = orders.filter(
    (o) =>
      o.status === 'active' &&
      (o.approval === 'pending' || (o.pending && o.approval === 'approved')),
  );
  const rest = orders.filter((o) => !queue.includes(o));
  return (
    <>
      {notice && <output className="notice">{notice.slice(0, 600)}</output>}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Top bar and display order</h2>
          <p>
            The bar rotates through approved sponsors with a bar placement in
            the order below, pausing while hovered; the same order decides which
            cards lead the home page (first four) and the listing pages. Hidden
            orders stay out of every slot until shown again; a cancelled or
            lapsed subscription drops out on its own. AstroFabric fills any
            empty slot.
          </p>
        </div>
        <form action={saveBarSettings} className="admin-actions">
          <label htmlFor="bar-seconds" className="input-label">
            Seconds per sponsor in the bar
          </label>
          <input
            id="bar-seconds"
            name="seconds"
            type="number"
            min={5}
            max={600}
            defaultValue={bar.intervalSeconds}
            style={{ flex: '0 0 120px' }}
          />
          <button className="button" type="submit">
            Save interval
          </button>
        </form>
        {live.length ? (
          <ol className="bar-order">
            {live.map((o, i) => (
              <li key={o.stripe_session_id}>
                <span className="mono">{i + 1}</span>
                <strong>{o.product}</strong>
                <span className="badge">
                  {placementById(o.placement)?.name ?? o.placement}
                </span>
                {o.hidden && <span className="badge rejected">hidden</span>}
                {!o.livemode && <span className="badge test">test</span>}
                <form action={moveSponsor} className="admin-actions inline">
                  <input
                    type="hidden"
                    name="session"
                    value={o.stripe_session_id}
                  />
                  <button
                    className="button"
                    name="direction"
                    value="up"
                    disabled={i === 0}
                  >
                    Up
                  </button>
                  <button
                    className="button"
                    name="direction"
                    value="down"
                    disabled={i === live.length - 1}
                  >
                    Down
                  </button>
                </form>
                <form
                  action={toggleSponsorHidden}
                  className="admin-actions inline"
                >
                  <input
                    type="hidden"
                    name="session"
                    value={o.stripe_session_id}
                  />
                  <input
                    type="hidden"
                    name="hidden"
                    value={o.hidden ? 'false' : 'true'}
                  />
                  <button className="button" type="submit">
                    {o.hidden ? 'Show' : 'Hide'}
                  </button>
                </form>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">
            No approved, active sponsorships yet; the bar shows AstroFabric.
          </p>
        )}
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            Awaiting approval <b>{queue.length}</b>
          </h2>
          <p>
            Sponsors are told to expect a decision within 24–48 hours and have
            already paid the first month at checkout. Approving makes the
            placement render immediately. Reject · ask to amend keeps the
            subscription and emails the note as what to change; Reject &amp;
            refund cancels the subscription and refunds the payment.
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
