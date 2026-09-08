'use client';

import { useState, type ReactNode } from 'react';
import { CornerBrackets } from '@/components/design-interactions';

export default function PricingOptions({
  free,
  paid,
}: {
  free: ReactNode;
  paid: ReactNode;
}) {
  const [plan, setPlan] = useState('free');
  return (
    <>
      <div className="pricing-grid">
        {(
          [
            ['free', free],
            ['paid', paid],
          ] as const
        ).map(([value, content]) => (
          <section
            className={`pricing-card ${value === 'paid' ? 'paid' : ''} ${plan === value ? 'is-selected' : ''}`}
            key={value}
            onPointerDown={() => setPlan(value)}
          >
            <CornerBrackets />
            <button
              type="button"
              className="plan-select"
              onClick={() => setPlan(value)}
              aria-pressed={plan === value}
              aria-label={`Select ${value === 'free' ? 'free with Agentic' : 'one-time paid listing'}`}
            >
              {plan === value ? 'SELECTED' : 'SELECT'}
            </button>
            {content}
          </section>
        ))}
      </div>
      <output className="plan-summary">
        SELECTED · {plan === 'free' ? 'FREE WITH AGENTIC' : 'ONE-TIME LISTING'}
      </output>
    </>
  );
}
