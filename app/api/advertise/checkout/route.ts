import { createHash } from 'node:crypto';
import {
  appUrl,
  body,
  HttpError,
  rateLimit,
  respond,
  sameOrigin,
} from '@/lib/server/http';
import { stripe } from '@/lib/server/payments';
import {
  creativeMetadata,
  creativeSchema,
  placementById,
} from '@/lib/advertising';
export const runtime = 'nodejs';
/** Recurring Stripe prices for each placement, created in the Stripe dashboard. */
export function placementPrice(placement: string) {
  return process.env['STRIPE_AD_PRICE_' + placement.toUpperCase()] || '';
}
function clientKey(request: Request) {
  const address =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    await rateLimit('advertise:' + clientKey(request), 10);
    const creative = creativeSchema.parse(await body(request, 8192));
    const placement = placementById(creative.placement)!;
    const price = placementPrice(placement.id);
    if (!price)
      throw new HttpError(
        503,
        'Sponsorship checkout is being configured. Contact us and we will set it up for you.',
      );
    const metadata = creativeMetadata(creative);
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: appUrl() + '/advertise/thanks?session={CHECKOUT_SESSION_ID}',
      cancel_url: appUrl() + '/advertise?cancelled=1',
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            'I agree to the [RUAGENTIC Terms](https://ruagentic.com/terms). Sponsorships follow the listing guidelines and rotate with other sponsors in the same placement.',
        },
        submit: {
          message:
            placement.name +
            ' for ' +
            creative.product +
            ', billed monthly. Cancel any time from the Stripe billing portal link in your receipt.',
        },
      },
    });
    if (!session.url) throw new HttpError(503, 'Checkout could not start.');
    return { url: session.url };
  });
}
