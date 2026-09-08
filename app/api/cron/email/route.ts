import { cronAuthorized, respond } from '@/lib/server/http';
import { deliverEmails } from '@/lib/server/email';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!cronAuthorized(request))
    return new Response('Unauthorized', { status: 401 });
  return respond(deliverEmails);
}
