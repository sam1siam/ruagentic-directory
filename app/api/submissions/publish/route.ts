import { after } from 'next/server';
import {
  respond,
  sameOrigin,
  signedIn,
  body,
  rateLimit,
} from '@/lib/server/http';
import { publishSubmission } from '@/lib/server/submissions';
import { deliverEmails } from '@/lib/server/email';
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('publish:' + user.id, 30);
    const result = await publishSubmission(user.id, await body(request));
    after(() => deliverEmails().then(() => {}));
    return result;
  });
}
