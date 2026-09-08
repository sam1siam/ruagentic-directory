import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { stripe } from '@/lib/server/payments';
import { recordAdOrder } from '@/lib/server/ads';
import { isAdMetadata, tierById } from '@/lib/advertising';
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
  let order: { tier: string; product: string; paid: boolean } | null = null;
  if (id && /^cs_[A-Za-z0-9_]+$/.test(id)) {
    try {
      const session = await stripe().checkout.sessions.retrieve(id);
      if (isAdMetadata(session.metadata) && session.status === 'complete') {
        // Reconcile here as well as in the webhook so the placement appears immediately.
        await recordAdOrder(session).catch(() => {});
        order = {
          tier: tierById(session.metadata.tier)?.name ?? session.metadata.tier,
          product: session.metadata.product,
          paid: session.payment_status === 'paid',
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
              ? `${order.product} is sponsoring RUAGENTIC.`
              : 'Payment is being confirmed.'
            : 'Thank you.'}
        </h1>
        <p>
          {order
            ? order.paid
              ? `Your ${order.tier} placement is active and appears within minutes. Stripe emails your receipt and a link to manage or cancel the subscription.`
              : 'Your placement activates as soon as Stripe confirms the payment. Stripe emails your receipt.'
            : 'If you completed a checkout, your placement activates as soon as Stripe confirms it. Contact us if you need help.'}
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
