import { createHash, timingSafeEqual } from 'node:crypto';
import { ZodError, z } from 'zod';
import { userClient, adminClient } from '../supabase/server';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function appUrl() {
  const url = new URL(process.env.APP_URL ?? 'https://ruagentic.com');
  return url.origin;
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== appUrl())
    throw new HttpError(403, 'Open this form on RUAGENTIC and try again.');
}
export async function body(request: Request, limit = 24000) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new HttpError(413, 'The submission is too large.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'The submitted data could not be read.');
  }
}
export async function signedIn() {
  const client = await userClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'Sign in to continue.');
  if (!data.user.email_confirmed_at)
    throw new HttpError(403, 'Confirm your email address before submitting.');
  return data.user;
}
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export async function rateLimit(key: string, limit = 12, seconds = 3600) {
  const { data, error } = await adminClient().rpc('consume_rate_limit', {
    p_key: hash(key),
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new HttpError(503, 'Please try again shortly.');
  if (!data)
    throw new HttpError(
      429,
      'This action has reached its request limit. Please try again later.',
    );
}
export function cronAuthorized(request: Request) {
  const actual = Buffer.from(request.headers.get('authorization') ?? ''),
    expected = Buffer.from('Bearer ' + (process.env.CRON_SECRET ?? ''));
  return (
    Boolean(process.env.CRON_SECRET) &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
export async function respond(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return Response.json(
        {
          error: 'Please check the highlighted fields.',
          fields: z.flattenError(error).fieldErrors,
        },
        { status: 400 },
      );
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error(
      'directory_request_failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return Response.json(
      {
        error:
          'This action could not finish. Your saved information is preserved. Please try again.',
      },
      { status: 503 },
    );
  }
}
