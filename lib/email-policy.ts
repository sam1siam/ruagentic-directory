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
    text: `Your listing for ${payload.name} is published.\n\nView your listing: ${url}\nManage your listing: https://ruagentic.com/dashboard\n\n${payload.method === 'payment' ? 'Your one-time listing payment is confirmed. Stripe sends the payment receipt.' : 'Your Agentic files passed the free listing publication check.'}`,
    html: `<h1>Your listing is published</h1><p>${escapeHtml(payload.name)} is now listed on RUAGENTIC.</p><p><a href="${url}">View your listing</a></p><p><a href="https://ruagentic.com/dashboard">Manage your listing</a></p><p>${payload.method === 'payment' ? 'Your one-time listing payment is confirmed. Stripe sends the payment receipt.' : 'Your Agentic files passed the free listing publication check.'}</p>`,
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
          now + Math.min(3600000, 30000 * 2 ** attempts),
        ).toISOString(),
      };
}
