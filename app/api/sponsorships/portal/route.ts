import { z } from 'zod';
import {
  appUrl,
  body,
  rateLimit,
  respond,
  sameOrigin,
  signedIn,
} from '@/lib/server/http';
import { ownedOrder, portalUrl } from '@/lib/server/sponsorships';
export const runtime = 'nodejs';
/** Opens Stripe's Customer Portal for one of the caller's sponsorships. */
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('portal:' + user.id, 20);
    const { session } = z
      .object({ session: z.string().regex(/^cs_[A-Za-z0-9_]+$/) })
      .strict()
      .parse(await body(request, 2048));
    const order = await ownedOrder(user.id, session);
    return { url: await portalUrl(order, appUrl() + '/dashboard') };
  });
}
