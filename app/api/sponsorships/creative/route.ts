import { z } from 'zod';
import {
  body,
  rateLimit,
  respond,
  sameOrigin,
  signedIn,
} from '@/lib/server/http';
import {
  ownedOrder,
  reconcileCategoryBilling,
  saveCreative,
} from '@/lib/server/sponsorships';
import {
  creativeEditSchema,
  parseCategories,
  type PlacementId,
} from '@/lib/advertising';
import { HttpError } from '@/lib/server/http';
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
    // Category changes are charged or credited now, with proration; the
    // creative itself still waits for review. If Stripe refuses, nothing is
    // saved.
    const live = parseCategories(order.categories).sort().join(',');
    const next = [...edit.categories].sort().join(',');
    let billing = 'none';
    if (live !== next && order.stripe_subscription_id) {
      try {
        billing = (
          await reconcileCategoryBilling({
            stripe_subscription_id: order.stripe_subscription_id,
            placement: order.placement,
            categories: edit.categories.join(','),
          })
        ).action;
      } catch {
        throw new HttpError(
          502,
          'The billing change could not be applied, so nothing was saved. Try again or contact us.',
        );
      }
    }
    const result = await saveCreative(order, edit);
    return { result, billing };
  });
}
