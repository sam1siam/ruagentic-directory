'use client';

import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  includesCard,
  placements,
  type PlacementId,
  type Sponsor,
} from '@/lib/advertising';
import { api } from '@/lib/client-api';
import { CornerBrackets } from '@/components/design-interactions';
import { SponsorCard } from '@/components/sponsor';

const TAGLINE_HINT = 'One sentence that makes users click.';
const DESCRIPTION_HINT =
  'Two or three sentences about what your product does and who it is for.';

export default function AdvertiseForm({ cancelled }: { cancelled?: boolean }) {
  const [placement, setPlacement] = useState<PlacementId>('both'),
    [product, setProduct] = useState(''),
    [tagline, setTagline] = useState(''),
    [url, setUrl] = useState(''),
    [description, setDescription] = useState(''),
    [cta, setCta] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const selected = placements.find((p) => p.id === placement)!;
  const card = includesCard(placement);
  const preview: Sponsor = {
    name: product || 'Your product',
    tagline: tagline || TAGLINE_HINT,
    description: description || DESCRIPTION_HINT,
    cta: cta || 'Visit',
    url: url || 'https://example.com/',
    placement,
  };
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
            placement,
            product,
            tagline,
            url,
            description: card ? description : '',
            cta: card ? cta : '',
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
          <span className="step-no">1</span> Choose your placement
        </h2>
        <div className="tier-grid">
          {placements.map((p) => (
            <label
              key={p.id}
              className={
                'tier-card glass' + (placement === p.id ? ' is-selected' : '')
              }
            >
              <CornerBrackets amber={p.id === 'both'} small />
              <input
                type="radio"
                name="placement"
                value={p.id}
                checked={placement === p.id}
                onChange={() => setPlacement(p.id)}
              />
              <span className="tier-name">{p.name}</span>
              <span className="tier-price">
                {p.display}
                <small>/ month</small>
              </span>
              <span className="tier-placement">{p.placement}</span>
              {p.save && <span className="tier-save">{p.save}</span>}
            </label>
          ))}
        </div>
        <p className="muted">
          Billed monthly · cancel anytime through the Stripe billing link in
          your receipt · sponsors in the same placement rotate evenly.
        </p>
      </section>
      <section className="advertise-step">
        <h2>
          <span className="step-no">2</span> Your ad
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
                placeholder="https://acme.ai/"
              />
            </div>
            <small>
              We add <code>ref=ruagentic.com</code> to the link so you can see
              visits from the directory.
            </small>
          </div>
          <div className="field full">
            <label htmlFor="ad-tagline" className="input-label">
              Tagline <b>· {tagline.length}/120</b>
            </label>
            <div className="input-shell">
              <input
                id="ad-tagline"
                required
                minLength={10}
                maxLength={120}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder={TAGLINE_HINT}
              />
            </div>
            <small>
              Shown next to your name in the sponsor bar. Text only; the mark is
              a two-letter monogram of your product name.
            </small>
          </div>
          {card && (
            <>
              <div className="field full">
                <label htmlFor="ad-description" className="input-label">
                  Card description <b>· {description.length}/200</b>
                </label>
                <div className="input-shell">
                  <textarea
                    id="ad-description"
                    required
                    minLength={20}
                    maxLength={200}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={DESCRIPTION_HINT}
                  />
                </div>
                <small>
                  Shown on the featured card and the detail-page tile.
                </small>
              </div>
              <div className="field">
                <label htmlFor="ad-cta" className="input-label">
                  Button label <b>· optional</b>
                </label>
                <div className="input-shell">
                  <input
                    id="ad-cta"
                    maxLength={24}
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder="Visit"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="advertise-previews">
          {placement !== 'card' && (
            <div>
              <span className="advertise-preview-label">Top bar preview</span>
              <div className="advertise-preview" aria-label="Top bar preview">
                <span className="sponsor-label">Sponsored by</span>
                <span className="sponsor-chip">{preview.name}</span>
                <span className="sponsor-tagline">— {preview.tagline}</span>
              </div>
            </div>
          )}
          {card && (
            <div>
              <span className="advertise-preview-label">
                Featured card preview
              </span>
              <div className="advertise-card-preview" aria-label="Card preview">
                <SponsorCard sponsor={preview} />
              </div>
            </div>
          )}
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy && <LoaderCircle size={14} className="spin" />}
        Continue to payment ({selected.display}/month) →
      </button>
    </form>
  );
}
