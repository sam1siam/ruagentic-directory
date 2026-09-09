'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { PublicListing } from '@/lib/listing';
import { Button } from './ui/button';
import HudSelect from '@/components/hud-select';
export default function Compare({
  listings,
  initial,
}: {
  listings: Pick<
    PublicListing,
    | 'slug'
    | 'name'
    | 'kind'
    | 'summary'
    | 'category'
    | 'pricing'
    | 'transport'
    | 'authentication'
    | 'homepage'
    | 'documentation'
    | 'source'
    | 'agenticCheckedAt'
  >[];
  initial: string[];
}) {
  const [selected, setSelected] = useState(initial.slice(0, 4)),
    [candidate, setCandidate] = useState('');
  const items = selected
    .map((slug) => listings.find((l) => l.slug === slug))
    .filter(Boolean) as typeof listings;
  function update(next: string[]) {
    setSelected(next);
    window.history.replaceState(
      null,
      '',
      '/compare' +
        (next.length ? '?tools=' + next.map(encodeURIComponent).join(',') : ''),
    );
    try {
      localStorage.setItem('ruagentic:compare', JSON.stringify(next));
    } catch {}
  }
  return (
    <>
      <div className="compare-picker">
        <label className="sr-only" htmlFor="compare-tool">
          Choose a tool
        </label>
        <HudSelect
          id="compare-tool"
          value={candidate}
          onValueChange={setCandidate}
          placeholder="Choose a tool to compare"
          className="compare-select"
          options={listings
            .filter((l) => !selected.includes(l.slug))
            .map((l) => [l.slug, l.name] as const)}
        />
        <Button
          disabled={!candidate || selected.length >= 4}
          onClick={() => {
            update([...selected, candidate]);
            setCandidate('');
          }}
        >
          Add to comparison
        </Button>
      </div>
      {items.length ? (
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                {items.map((item) => (
                  <th key={item.slug} scope="col">
                    <Link href={'/tools/' + item.slug}>{item.name} ↗</Link>
                    <button
                      onClick={() =>
                        update(selected.filter((s) => s !== item.slug))
                      }
                    >
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Type', 'kind'],
                ['What it does', 'summary'],
                ['Category', 'category'],
                ['Pricing', 'pricing'],
                ['Transport', 'transport'],
                ['Authentication', 'authentication'],
                ['Information source', 'source'],
              ].map(([label, key]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {items.map((item) => (
                    <td key={item.slug}>
                      {String(
                        item[key as keyof typeof item] ?? 'Not specified',
                      ).replace(/^unknown$/, 'Not specified')}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Agentic Protocol files</th>
                {items.map((item) => (
                  <td key={item.slug}>
                    {item.agenticCheckedAt
                      ? 'Checked ' +
                        new Date(item.agenticCheckedAt).toLocaleDateString()
                      : 'Not checked by RUAGENTIC'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Get started</th>
                {items.map((item) => (
                  <td key={item.slug}>
                    <a
                      className="text-link"
                      href={item.documentation || item.homepage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open project docs ↗
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h2>Find the right fit.</h2>
          <p>
            Add up to four tools to compare their published capabilities and
            connection details.
          </p>
        </div>
      )}
    </>
  );
}
