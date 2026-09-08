import {
  respond,
  sameOrigin,
  signedIn,
  body,
  rateLimit,
} from '@/lib/server/http';
import { startCheckout, cancelCheckout } from '@/lib/server/payments';
import { z } from 'zod';
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('checkout:' + user.id, 12);
    return startCheckout(user.id, await body(request));
  });
}
export async function DELETE(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('cancel-checkout:' + user.id, 20);
    const { id } = z.object({ id: z.uuid() }).parse(await body(request));
    return cancelCheckout(user.id, id);
  });
}
