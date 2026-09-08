import {
  respond,
  sameOrigin,
  signedIn,
  body,
  rateLimit,
} from '@/lib/server/http';
import { auditSubmission } from '@/lib/server/submissions';
export const runtime = 'nodejs';
export const maxDuration = 90;
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('audit:' + user.id, 12);
    return { audit: await auditSubmission(user.id, await body(request)) };
  });
}
