'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CornerBrackets } from '@/components/design-interactions';

type Plan = 'free' | 'paid';

export default function PricingOptions({
  free,
  paid,
}: {
  free: ReactNode;
  paid: ReactNode;
}) {
  const [plan, setPlan] = useState<Plan>('free');
  const grid = useRef<HTMLDivElement>(null);
  // Clicking anywhere on a card selects it; the SELECT button is the keyboard control.
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const select = (event: MouseEvent) => {
      const card =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-plan]')
          : null;
      if (card?.dataset.plan) setPlan(card.dataset.plan as Plan);
    };
    element.addEventListener('click', select);
    return () => element.removeEventListener('click', select);
  }, []);
  return (
    <>
      <div className="pricing-grid" ref={grid}>
        {(
          [
            ['free', free],
            ['paid', paid],
          ] as const
        ).map(([value, content]) => (
          <section
            className={`pricing-card glass${value === 'paid' ? ' paid' : ''}${plan === value ? ' is-selected' : ''}`}
            key={value}
            data-plan={value}
            aria-label={
              value === 'free'
                ? 'Free with Agentic Protocol'
                : 'One-time listing'
            }
          >
            <CornerBrackets amber={value === 'paid'} />
            <button
              type="button"
              className="plan-select"
              onClick={() => setPlan(value)}
              aria-pressed={plan === value}
              aria-label={`Select ${value === 'free' ? 'free with Agentic Protocol' : 'one-time paid listing'}`}
            >
              {plan === value ? 'SELECTED' : 'SELECT'}
            </button>
            {content}
          </section>
        ))}
      </div>
      <output className="plan-summary" aria-live="polite">
        <span>
          SELECTED ·{' '}
          <b>{plan === 'free' ? 'FREE WITH AGENTIC' : 'ONE-TIME LISTING'}</b>
        </span>
        <span>
          PAYMENT · <b>{plan === 'free' ? 'NONE' : 'STRIPE CHECKOUT'}</b>
        </span>
        <span>REFUNDS · VIA SUPPORT</span>
      </output>
    </>
  );
}
