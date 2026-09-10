'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  badgeLabel,
  badgeSnippets,
  isVerified,
  CARD_HEIGHT,
  CARD_WIDTH,
  type BadgeItem,
} from '@/lib/badge';

/** Badge and card previews with copy-paste Markdown and HTML snippets. */
export default function BadgeKit({ item }: { item: BadgeItem }) {
  const snippets = badgeSnippets(item);
  const [copied, setCopied] = useState('');
  const entries = [
    ['Markdown badge', snippets.markdownBadge],
    ['HTML badge', snippets.htmlBadge],
    ['Markdown card', snippets.markdownCard],
    ['HTML embed', snippets.htmlEmbed],
  ] as const;
  async function copy(label: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  }
  return (
    <div className="badge-kit">
      <div className="badge-previews">
        {/* oxlint-disable-next-line nextjs/no-img-element -- generated svg served by this site */}
        <img
          src={'/badge/' + encodeURIComponent(item.slug) + '.svg'}
          alt={badgeLabel(isVerified(item))}
          height={28}
        />
        {/* oxlint-disable-next-line nextjs/no-img-element -- generated svg served by this site */}
        <img
          src={'/embed/' + encodeURIComponent(item.slug) + '.svg'}
          alt={item.name + ' on RUAGENTIC'}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
        />
      </div>
      <div className="badge-snippets">
        {entries.map(([label, code]) => (
          <div className="snippet" key={label}>
            <span className="label">
              {label}
              <button type="button" onClick={() => copy(label, code)}>
                {copied === label ? <Check size={13} /> : <Copy size={13} />}
                {copied === label ? 'Copied' : 'Copy'}
              </button>
            </span>
            <pre>
              <code>{code}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
