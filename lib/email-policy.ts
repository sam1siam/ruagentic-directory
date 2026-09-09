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
/** Sent to a sponsor once their checkout is recorded as paid. */
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
  const where =
    order.placement === 'Top bar'
      ? 'the sponsor bar at the top of every page'
      : order.placement === 'Featured card'
        ? 'the featured card and detail tiles in ' + list(order.categories)
        : 'the sponsor bar on every page and the featured card and detail tiles in ' +
          list(order.categories);
  const test = order.livemode ? '' : ' (test mode)';
  return {
    subject: 'Your RUAGENTIC sponsorship is live' + test,
    text: `${order.product} is now sponsoring RUAGENTIC${test}.\n\nPlacement: ${order.placement} (${order.total} a month)\nWhere it appears: ${where}\nYour sponsor page: ${page}\n\nYour placement appears within minutes and stays live while the subscription is active. Stripe emails your receipt and a link to manage or cancel the subscription. To change your creative, reply to this email.\n\nSponsorship never changes rankings, source labels or Agentic Protocol checks, and it is labelled as sponsored wherever it appears.`,
    html: `<h1>Your sponsorship is live${escapeHtml(test)}</h1><p>${escapeHtml(order.product)} is now sponsoring RUAGENTIC.</p><p><strong>Placement:</strong> ${escapeHtml(order.placement)} (${escapeHtml(order.total)} a month)<br><strong>Where it appears:</strong> ${escapeHtml(where)}<br><strong>Your sponsor page:</strong> <a href="${page}">${page}</a></p><p>Your placement appears within minutes and stays live while the subscription is active. Stripe emails your receipt and a link to manage or cancel the subscription. To change your creative, reply to this email.</p><p>Sponsorship never changes rankings, source labels or Agentic Protocol checks, and it is labelled as sponsored wherever it appears.</p>`,
  };
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
