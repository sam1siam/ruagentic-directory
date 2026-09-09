import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { stripe } from '@/lib/server/payments';
import { recordAdOrder } from '@/lib/server/ads';
import { isAdMetadata, placementById, sponsorSlug } from '@/lib/advertising';
import { reviewWindow } from '@/lib/admin-policy';
import { CornerBrackets } from '@/components/design-interactions';
export const metadata = {
  title: 'Sponsorship confirmed',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: id } = await searchParams;
  let order: {
    placement: string;
    product: string;
    paid: boolean;
    page: string;
  } | null = null;
  if (id && /^cs_[A-Za-z0-9_]+$/.test(id)) {
    try {
      const session = await stripe().checkout.sessions.retrieve(id);
      if (isAdMetadata(session.metadata) && session.status === 'complete') {
        // Reconcile here as well as in the webhook so the placement appears immediately.
        await recordAdOrder(session).catch(() => {});
        order = {
          placement:
            placementById(session.metadata.placement)?.name ??
            session.metadata.placement,
          product: session.metadata.product,
          paid: session.payment_status === 'paid',
          page:
            '/sponsors/' + sponsorSlug(session.metadata.product, session.id),
        };
      }
    } catch {
      order = null;
    }
  }
  return (
    <main className="content-page narrow">
      <div className="confirmation-card glass">
        <CornerBrackets />
        <CheckCircle2 size={44} />
        <h1>
          {order
            ? order.paid
              ? `Thanks, ${order.product} is booked.`
              : 'Payment is being confirmed.'
            : 'Thank you.'}
        </h1>
        <p>
          {order
            ? order.paid
              ? `We review every creative and approve sponsorships within ${reviewWindow}. Your ${order.placement} placement goes live the moment it is approved, and we email you then. We have sent a confirmation with your sponsor page link; Stripe emails your receipt and a link to manage or cancel the subscription.`
              : `Once Stripe confirms the payment we review your creative and approve it within ${reviewWindow}. Stripe emails your receipt.`
            : `If you completed a checkout, we review your creative within ${reviewWindow} and email you when it is live. Contact us if you need help.`}
        </p>
        <div className="actions">
          <Link href="/" className="button primary">
            View the directory →
          </Link>
          <Link href="/contact" className="button">
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}
