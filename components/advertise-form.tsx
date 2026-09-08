'use client';

import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { tiers, type TierId } from '@/lib/advertising';
import { api } from '@/lib/client-api';
import { CornerBrackets } from '@/components/design-interactions';

export default function AdvertiseForm({ cancelled }: { cancelled?: boolean }) {
  const [tier, setTier] = useState<TierId>('platinum'),
    [product, setProduct] = useState(''),
    [tagline, setTagline] = useState(''),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const selected = tiers.find((t) => t.id === tier)!;
  return (
    <form
      className="advertise-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
          const result = await api('/api/advertise/checkout', {
            tier,
            product,
            tagline,
            url,
          });
          if (result.url) window.location.assign(result.url);
          else throw new Error('Checkout could not start.');
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      {cancelled && (
        <div className="notice">
          Checkout was cancelled. Your creative below is unchanged.
        </div>
      )}
      <section className="advertise-step">
        <h2>
          <span className="step-no">1</span> Your ad
        </h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ad-product" className="input-label">
              Product name
            </label>
            <div className="input-shell">
              <i aria-hidden="true">&gt;</i>
              <input
                id="ad-product"
                required
                minLength={2}
                maxLength={60}
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Acme AI"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ad-url" className="input-label">
              Target URL
            </label>
            <div className="input-shell code">
              <i aria-hidden="true">&gt;</i>
              <input
                id="ad-url"
                required
                type="url"
                maxLength={500}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://acme.ai/?ref=ruagentic"
              />
            </div>
          </div>
          <div className="field full">
            <label htmlFor="ad-tagline" className="input-label">
              Tagline <b>· {tagline.length}/160</b>
            </label>
            <div className="input-shell">
              <input
                id="ad-tagline"
                required
                minLength={10}
                maxLength={160}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="One sentence that makes developers click."
              />
            </div>
            <small>
              Shown next to your name in the sponsor bar, cards and tiles. Text
              only; the mark is a two-letter monogram of your product name.
            </small>
          </div>
        </div>
        <div className="advertise-preview" aria-label="Preview">
          <span className="sponsor-label">Preview</span>
          <span className="sponsor-chip">{product || 'Your product'}</span>
          <span className="sponsor-tagline">
            — {tagline || 'One sentence that makes developers click.'}
          </span>
        </div>
      </section>
      <section className="advertise-step">
        <h2>
          <span className="step-no">2</span> Choose your sponsor tier
        </h2>
        <div className="tier-grid">
          {tiers.map((t) => (
            <label
              key={t.id}
              className={
                'tier-card glass' + (tier === t.id ? ' is-selected' : '')
              }
            >
              <CornerBrackets amber={t.id === 'platinum'} small />
              <input
                type="radio"
                name="tier"
                value={t.id}
                checked={tier === t.id}
                onChange={() => setTier(t.id)}
              />
              <span className="tier-name">{t.name}</span>
              <span className="tier-price">
                {t.display}
                <small>/ month</small>
              </span>
              <span className="tier-placement">{t.placement}</span>
            </label>
          ))}
        </div>
        <p className="muted">
          Billed monthly · cancel anytime through the Stripe billing link in
          your receipt · sponsors rotate within each slot and higher tiers show
          first.
        </p>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy && <LoaderCircle size={14} className="spin" />}
        Continue to payment ({selected.display}) →
      </button>
    </form>
  );
}
