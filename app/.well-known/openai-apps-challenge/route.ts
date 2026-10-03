/** OpenAI's domain-verification challenge for the ChatGPT plugin portal:
 *  the exact token, as plain text, nothing else. Set OPENAI_APPS_CHALLENGE in
 *  Vercel to the token the portal shows; without it the path is a 404. */
export const dynamic = 'force-dynamic';
export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) return new Response('Not found', { status: 404 });
  return new Response(token, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
