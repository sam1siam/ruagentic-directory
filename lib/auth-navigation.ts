import { safeNext } from './listing.ts';
/** Email templates receive an absolute RedirectTo. Accept our own origin only. */
export function emailNext(value: string | null, origin: string) {
  // Reject control characters before URL normalization.
  // eslint-disable-next-line no-control-regex
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//'))
    return '/dashboard';
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.username || url.password || url.hash)
      return '/dashboard';
    return safeNext(url.pathname + url.search);
  } catch {
    return '/dashboard';
  }
}
export function authRedirect(
  origin: string,
  next: string,
  method: 'email' | 'github',
) {
  const path = safeNext(next);
  return (
    origin +
    (method === 'email'
      ? path
      : '/auth/callback?next=' + encodeURIComponent(path))
  );
}
export const authResponseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'strict-origin',
};
export async function handleOAuthCallback(
  request: Request,
  origin: string,
  exchange: (code: string) => Promise<boolean>,
) {
  const params = new URL(request.url).searchParams,
    next = safeNext(params.get('next')),
    code = params.get('code');
  let reason = params.has('error') ? 'oauth-cancelled' : 'oauth';
  if (
    code &&
    code.length <= 2048 &&
    params.getAll('code').length === 1 &&
    !params.has('error')
  ) {
    try {
      if (await exchange(code))
        return new Response(null, {
          status: 303,
          headers: {
            ...authResponseHeaders,
            Location: new URL(next, origin).href,
          },
        });
    } catch {
      reason = 'unavailable';
    }
  }
  const retry = new URL('/login', origin);
  retry.searchParams.set('error', reason);
  retry.searchParams.set('next', next);
  return new Response(null, {
    status: 303,
    headers: { ...authResponseHeaders, Location: retry.href },
  });
}
