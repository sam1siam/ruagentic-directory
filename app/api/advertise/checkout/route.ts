import { createHash } from 'node:crypto';
import {
  appUrl,
  body,
  HttpError,
  rateLimit,
  respond,
  sameOrigin,
  signedIn,
} from '@/lib/server/http';
import { stripe } from '@/lib/server/payments';
import {
  creativeMetadata,
  creativeSchema,
  includesCard,
  placementById,
  quote,
} from '@/lib/advertising';
import { categoryBySlug } from '@/lib/categories';
export const runtime = 'nodejs';
/** Recurring Stripe prices, created in the Stripe dashboard: one per
 *  placement plus the per-category extra. */
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
    const user = await signedIn();
    await rateLimit('advertise:' + clientKey(request), 10);
    const creative = creativeSchema.parse(await body(request, 8192));
    const placement = placementById(creative.placement)!;
    const price = placementPrice(placement.id);
    const extraPrice = placementPrice('category');
    const total = quote(creative.placement, creative.categories);
    if (!price || (total.extras > 0 && !extraPrice))
      throw new HttpError(
        503,
        'Sponsorship checkout is being configured. Contact us and we will set it up for you.',
      );
    const metadata = { ...creativeMetadata(creative), owner: user.id };
    const categoryNames = includesCard(creative.placement)
      ? creative.categories.map((s) => categoryBySlug(s)!.name)
      : [];
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        { price, quantity: 1 },
        ...(total.extras > 0
          ? [{ price: extraPrice, quantity: total.extras }]
          : []),
      ],
      success_url: appUrl() + '/advertise/thanks?session={CHECKOUT_SESSION_ID}',
      cancel_url: appUrl() + '/advertise?cancelled=1',
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      consent_collection: { terms_of_service: 'required' },
      branding_settings: {
        display_name: 'RUAGENTIC',
        background_color: '#0b0d0f',
        button_color: '#bcf36c',
      },
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
            (categoryNames.length ? ' in ' + categoryNames.join(', ') : '') +
            ', ' +
            total.display +
            ' billed monthly. Cancel any time from the Stripe billing portal link in your receipt.',
        },
      },
    });
    if (!session.url) throw new HttpError(503, 'Checkout could not start.');
    return { url: session.url };
  });
}
