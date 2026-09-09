import { z } from 'zod';
import {
  body,
  rateLimit,
  respond,
  sameOrigin,
  signedIn,
} from '@/lib/server/http';
import { ownedOrder, saveCreative } from '@/lib/server/sponsorships';
import { creativeEditSchema, type PlacementId } from '@/lib/advertising';
export const runtime = 'nodejs';
/** Saves an edited creative for review. */
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('creative:' + user.id, 30);
    const input = (await body(request, 8192)) as Record<string, unknown>;
    const { session } = z
      .object({ session: z.string().regex(/^cs_[A-Za-z0-9_]+$/) })
      .parse({ session: input?.session });
    const order = await ownedOrder(user.id, session);
    const { session: _ignored, ...rest } = input;
    void _ignored;
    const edit = creativeEditSchema(order.placement as PlacementId).parse(rest);
    const result = await saveCreative(order, edit);
    return { result };
  });
}
