import { boundedBody, BodyLimitError } from './bounded-body.ts';
import { safeNext } from './listing.ts';

type ConfirmationType = 'signup' | 'recovery' | 'email_change' | 'email';
type Confirmation = {
  token_hash: string;
  type: ConfirmationType;
  next: string;
};
type Verify = (
  input: Pick<Confirmation, 'token_hash' | 'type'>,
) => Promise<boolean>;

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  // no-referrer would turn a browser form POST's Origin into null.
  'Referrer-Policy': 'strict-origin',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function parse(params: URLSearchParams): Confirmation | null {
  if (
    ['token_hash', 'type', 'next'].some((key) => params.getAll(key).length > 1)
  )
    return null;
  const token = params.get('token_hash') ?? '';
  const type = params.get('type') ?? '';
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) return null;
  if (!['signup', 'recovery', 'email_change', 'email'].includes(type))
    return null;
  return {
    token_hash: token,
    type: type as ConfirmationType,
    next:
      type === 'recovery' ? '/reset-password' : safeNext(params.get('next')),
  };
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

function page(title: string, content: string, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · RUAGENTIC</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0c0e;color:#f4f4f5;font:16px/1.6 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(100%,480px);padding:32px;border:1px solid #303238;border-radius:16px;background:#121316}.brand{font-weight:750;letter-spacing:.08em;font-size:13px;color:#b8bdc8}h1{font-size:28px;line-height:1.2;margin:24px 0 16px}p{color:#b8bdc8;margin:16px 0}form{margin-top:24px}button{width:100%;padding:14px 20px;border:0;border-radius:8px;background:#f4f4f5;color:#111;font:inherit;font-weight:650;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #9ea9ff;outline-offset:4px}a{color:#f4f4f5}.back{display:inline-block;margin-top:24px}
</style></head><body><main><div class="brand">RUAGENTIC</div><h1>${title}</h1>${content}<a class="back" href="/login">Back to sign in</a></main></body></html>`,
    {
      status,
      headers: {
        ...privateHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    },
  );
}

function redirect(origin: string, path: string, status = 303) {
  return new Response(null, {
    status,
    headers: { ...privateHeaders, Location: new URL(path, origin).href },
  });
}

function retry(
  origin: string,
  type: string | null,
  status = 303,
  next: string | null = null,
) {
  const query = new URLSearchParams({
    error: 'link',
    next: type === 'recovery' ? '/reset-password' : safeNext(next),
  });
  return redirect(origin, '/login?' + query, status);
}

/** A GET/HEAD from an email scanner never calls verify or consumes the token. */
export async function handleConfirmation(
  request: Request,
  origin: string,
  verify: Verify,
) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const params = new URL(request.url).searchParams;
    const input = parse(params);
    if (!input)
      return retry(origin, params.get('type'), 307, params.get('next'));
    const title =
      input.type === 'recovery'
        ? 'Reset your password'
        : 'Confirm your email address';
    const label =
      input.type === 'recovery'
        ? 'Continue to reset password'
        : 'Confirm email address';
    const response = page(
      title,
      `<p>${input.type === 'recovery' ? 'Continue to choose a new password for your RUAGENTIC account.' : 'Confirm this email address to continue to your RUAGENTIC account.'}</p>
<form method="post" action="/auth/confirm">
<input type="hidden" name="token_hash" value="${escape(input.token_hash)}">
<input type="hidden" name="type" value="${escape(input.type)}">
<input type="hidden" name="next" value="${escape(input.next)}">
<button type="submit">${label}</button></form>`,
    );
    return request.method === 'HEAD'
      ? new Response(null, {
          status: response.status,
          headers: response.headers,
        })
      : response;
  }
  if (request.method !== 'POST')
    return new Response(null, {
      status: 405,
      headers: { ...privateHeaders, Allow: 'GET, HEAD, POST' },
    });
  if (request.headers.get('origin') !== origin)
    return page(
      'Open your email link again',
      '<p>Use the link in your email to open this form on RUAGENTIC.</p>',
      403,
    );
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/x-www-form-urlencoded'
  )
    return page(
      'Open your email link again',
      '<p>This confirmation form could not be read. Open the link in your email and try again.</p>',
      415,
    );
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(
      (await boundedBody(request, 4096)).toString('utf8'),
    );
  } catch (error) {
    return page(
      'Open your email link again',
      '<p>This confirmation form could not be read. Open the link in your email and try again.</p>',
      error instanceof BodyLimitError ? 413 : 400,
    );
  }
  const input = parse(params);
  if (!input) return retry(origin, params.get('type'), 303, params.get('next'));
  try {
    const valid = await verify({
      token_hash: input.token_hash,
      type: input.type,
    });
    return valid
      ? redirect(origin, input.next)
      : retry(origin, input.type, 303, input.next);
  } catch {
    return page(
      'Please try again',
      '<p>Account confirmation is temporarily unavailable. Open your email link again in a moment.</p>',
      503,
    );
  }
}
