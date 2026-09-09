import { reviewWindow } from './admin-policy.ts';
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function confirmationEmail(payload: {
  name: string;
  slug: string;
  method: string;
}) {
  const url = 'https://ruagentic.com/tools/' + encodeURIComponent(payload.slug);
  return {
    subject: 'Your RUAGENTIC listing is published',
    text: `Your listing for ${payload.name} is published.\n\nView your listing: ${url}\nManage your listing: https://ruagentic.com/dashboard\n\n${payload.method === 'payment' ? 'Your one-time listing payment is confirmed. Stripe sends the payment receipt.' : 'Your Agentic Protocol files passed the free listing publication check.'}`,
    html: `<h1>Your listing is published</h1><p>${escapeHtml(payload.name)} is now listed on RUAGENTIC.</p><p><a href="${url}">View your listing</a></p><p><a href="https://ruagentic.com/dashboard">Manage your listing</a></p><p>${payload.method === 'payment' ? 'Your one-time listing payment is confirmed. Stripe sends the payment receipt.' : 'Your Agentic Protocol files passed the free listing publication check.'}</p>`,
  };
}
export function retryDecision(
  attempts: number,
  firstAttempt: string,
  now = Date.now(),
) {
  return !Number.isFinite(Date.parse(firstAttempt)) ||
    !Number.isFinite(attempts) ||
    now - Date.parse(firstAttempt) > 23 * 3600000 ||
    attempts >= 8
    ? { state: 'uncertain', next: null }
    : {
        state: 'failed',
        next: new Date(
          now + Math.min(3600000, 30000 * 2 ** Math.max(0, attempts - 1)),
        ).toISOString(),
      };
}
/** Sent to a sponsor once their checkout is recorded as paid: the creative
 *  is reviewed before it renders. */
export function sponsorshipEmail(order: {
  product: string;
  placement: string;
  categories: string[];
  total: string;
  slug: string;
  livemode: boolean;
}) {
  const page =
    'https://ruagentic.com/sponsors/' + encodeURIComponent(order.slug);
  const where = placementWhere(order.placement, order.categories);
  const test = order.livemode ? '' : ' (test mode)';
  return {
    subject: 'Your RUAGENTIC sponsorship is in review' + test,
    text: `Thanks for sponsoring RUAGENTIC${test}. We received your order for ${order.product}.\n\nPlacement: ${order.placement} (${order.total} a month)\nWhere it will appear: ${where}\nYour sponsor page once live: ${page}\n\nWe review every creative against the listing guidelines and approve sponsorships within ${reviewWindow}. You will get an email the moment it goes live. Manage billing, edit your creative or cancel any time from your dashboard: https://ruagentic.com/dashboard\n\nSponsorship never changes rankings, source labels or Agentic Protocol checks, and it is labelled as sponsored wherever it appears.`,
    html: `<h1>Your sponsorship is in review${escapeHtml(test)}</h1><p>Thanks for sponsoring RUAGENTIC. We received your order for ${escapeHtml(order.product)}.</p><p><strong>Placement:</strong> ${escapeHtml(order.placement)} (${escapeHtml(order.total)} a month)<br><strong>Where it will appear:</strong> ${escapeHtml(where)}<br><strong>Your sponsor page once live:</strong> <a href="${page}">${page}</a></p><p>We review every creative against the listing guidelines and approve sponsorships within ${reviewWindow}. You will get an email the moment it goes live. Manage billing, edit your creative or cancel any time from <a href="https://ruagentic.com/dashboard">your dashboard</a>.</p><p>Sponsorship never changes rankings, source labels or Agentic Protocol checks, and it is labelled as sponsored wherever it appears.</p>`,
  };
}
/** Sent when a reviewer approves or rejects the creative. */
export function sponsorshipDecisionEmail(order: {
  decision: 'approved' | 'rejected';
  product: string;
  placement: string;
  slug: string;
  note: string;
  /** True when the decision concerns edits to an already live creative. */
  changes?: boolean;
  /** Set when the subscription was cancelled and the payment refunded. */
  refunded?: { amount: string };
}) {
  const page =
    'https://ruagentic.com/sponsors/' + encodeURIComponent(order.slug);
  if (order.changes)
    return order.decision === 'approved'
      ? {
          subject: 'Your RUAGENTIC sponsorship changes are live',
          text: `The changes to the ${order.product} creative are now live on RUAGENTIC. Any category change is billed with proration from today.\n\nManage your sponsorship: https://ruagentic.com/dashboard${order.note ? '\n\nNote from the reviewer: ' + order.note : ''}`,
          html: `<h1>Your changes are live</h1><p>The changes to the ${escapeHtml(order.product)} creative are now live on RUAGENTIC. Any category change is billed with proration from today.</p><p><a href="https://ruagentic.com/dashboard">Manage your sponsorship</a></p>${order.note ? '<p><strong>Note from the reviewer:</strong> ' + escapeHtml(order.note) + '</p>' : ''}`,
        }
      : {
          subject: 'Your RUAGENTIC sponsorship changes were not approved',
          text: `We reviewed the changes to the ${order.product} creative and could not approve them; your current creative stays live.${order.note ? '\n\nReason: ' + order.note : ''}\n\nEdit and resend from your dashboard: https://ruagentic.com/dashboard`,
          html: `<h1>Changes not approved</h1><p>We reviewed the changes to the ${escapeHtml(order.product)} creative and could not approve them; your current creative stays live.</p>${order.note ? '<p><strong>Reason:</strong> ' + escapeHtml(order.note) + '</p>' : ''}<p><a href="https://ruagentic.com/dashboard">Edit and resend from your dashboard</a></p>`,
        };
  if (order.decision === 'approved')
    return {
      subject: 'Your RUAGENTIC sponsorship is live',
      text: `${order.product} is now live on RUAGENTIC.\n\nPlacement: ${order.placement}\nYour sponsor page: ${page}\n\nYour placement stays live while the subscription is active. Stripe holds your receipt and a link to manage or cancel. To change your creative, reply to this email.${order.note ? '\n\nNote from the reviewer: ' + order.note : ''}`,
      html: `<h1>Your sponsorship is live</h1><p>${escapeHtml(order.product)} is now live on RUAGENTIC.</p><p><strong>Placement:</strong> ${escapeHtml(order.placement)}<br><strong>Your sponsor page:</strong> <a href="${page}">${page}</a></p><p>Your placement stays live while the subscription is active. Stripe holds your receipt and a link to manage or cancel. To change your creative, reply to this email.</p>${order.note ? '<p><strong>Note from the reviewer:</strong> ' + escapeHtml(order.note) + '</p>' : ''}`,
    };
  if (order.refunded)
    return {
      subject:
        'Your RUAGENTIC sponsorship was not approved and has been refunded',
      text: `We reviewed the creative for ${order.product} and could not approve it.${order.note ? '\n\nReason: ' + order.note : ''}\n\nWe have cancelled the subscription${order.refunded.amount ? ' and refunded ' + order.refunded.amount : ''}; the refund reaches your card within a few business days and nothing further is due. You are welcome to submit a new creative at https://ruagentic.com/advertise. Sponsorships follow the listing guidelines: https://ruagentic.com/guidelines`,
      html: `<h1>Your sponsorship was not approved and has been refunded</h1><p>We reviewed the creative for ${escapeHtml(order.product)} and could not approve it.</p>${order.note ? '<p><strong>Reason:</strong> ' + escapeHtml(order.note) + '</p>' : ''}<p>We have cancelled the subscription${order.refunded.amount ? ' and refunded ' + escapeHtml(order.refunded.amount) : ''}; the refund reaches your card within a few business days and nothing further is due. You are welcome to <a href="https://ruagentic.com/advertise">submit a new creative</a>. Sponsorships follow the <a href="https://ruagentic.com/guidelines">listing guidelines</a>.</p>`,
    };
  return {
    subject: 'Your RUAGENTIC sponsorship needs a change before it goes live',
    text: `We reviewed the creative for ${order.product} and could not approve it as submitted.${order.note ? '\n\nWhat to change: ' + order.note : ''}\n\nEdit your creative from your dashboard and send it for review again: https://ruagentic.com/dashboard. Your subscription stays active and the placement goes live as soon as the amended creative is approved. If you would rather cancel, reply to this email and we will cancel and refund it. Sponsorships follow the listing guidelines: https://ruagentic.com/guidelines`,
    html: `<h1>Your sponsorship needs a change before it goes live</h1><p>We reviewed the creative for ${escapeHtml(order.product)} and could not approve it as submitted.</p>${order.note ? '<p><strong>What to change:</strong> ' + escapeHtml(order.note) + '</p>' : ''}<p><a href="https://ruagentic.com/dashboard">Edit your creative from your dashboard</a> and send it for review again. Your subscription stays active and the placement goes live as soon as the amended creative is approved. If you would rather cancel, reply to this email and we will cancel and refund it. Sponsorships follow the <a href="https://ruagentic.com/guidelines">listing guidelines</a>.</p>`,
  };
}
function placementWhere(placement: string, categories: string[]) {
  return placement === 'Top bar'
    ? 'the sponsor bar at the top of every page'
    : placement === 'Featured card'
      ? 'the featured card and detail tiles in ' + list(categories)
      : 'the sponsor bar on every page and the featured card and detail tiles in ' +
        list(categories);
}
/** Sent to the site owner when a sponsorship is recorded. */
export function sponsorshipNotice(order: {
  product: string;
  placement: string;
  categories: string[];
  total: string;
  slug: string;
  livemode: boolean;
  email: string | null;
}) {
  const page =
    'https://ruagentic.com/sponsors/' + encodeURIComponent(order.slug);
  const text = `New sponsorship${order.livemode ? '' : ' (test mode)'}: ${order.product}\nPlacement: ${order.placement} (${order.total} a month)\nCategories: ${list(order.categories)}\nSponsor email: ${order.email ?? 'not provided'}\nSponsor page: ${page}\n\nReview the creative against the listing guidelines. Stripe holds the subscription and receipt.`;
  return {
    subject: `New sponsorship: ${order.product} (${order.placement})`,
    text,
    html: '<pre style="font:14px/1.5 monospace">' + escapeHtml(text) + '</pre>',
  };
}
function list(categories: string[]) {
  return categories.length
    ? categories.map((c) => c.replace(/-/g, ' ')).join(', ')
    : 'all categories';
}
