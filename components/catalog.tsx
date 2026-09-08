'use client';

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Search, SlidersHorizontal, Tag } from 'lucide-react';
import { registerDirectoryFilter, browserModelContext } from '@/lib/webmcp';
import {
  CheckerDemo,
  CornerBrackets,
  DecodeHeadline,
  useShortcutLabel,
} from '@/components/design-interactions';
import ToolCard from '@/components/tool-card';

export type CatalogListing = {
  slug: string;
  name: string;
  kind: string;
  summary: string;
  category: string;
  homepage: string;
  tags: string[];
  source: string;
};

const categories = [
  'All categories',
  'Developer tools',
  'Data & intelligence',
  'Productivity',
  'Search & research',
  'Communication',
  'Design & content',
  'Infrastructure',
  'Finance',
  'Automation',
];
const chips = [
  ['Developer tools', 'Developer tools'],
  ['Data & intelligence', 'Data & intelligence'],
  ['Automation', 'Automation'],
  ['Search', 'Search & research'],
] as const;
const kinds = [
  ['all', 'All tools'],
  ['server', 'MCP servers'],
  ['client', 'Clients'],
  ['product', 'Agentic products'],
] as const;

export default function Catalog({
  listings,
  initial = {},
}: {
  listings: CatalogListing[];
  initial?: { q?: string; kind?: string; category?: string };
}) {
  const [query, setQuery] = useState(initial.q ?? ''),
    [kind, setKind] = useState(initial.kind ?? 'all'),
    [category, setCategory] = useState(initial.category ?? 'All categories'),
    [sort, setSort] = useState('name');
  const shortcut = useShortcutLabel();

  useEffect(
    () =>
      registerDirectoryFilter(browserModelContext(), (input) => {
        flushSync(() => {
          setQuery(input.query);
          setKind(input.kind);
          setCategory(input.category);
        });
        const matches = listings.filter(
          (r) =>
            (input.kind === 'all' || r.kind === input.kind) &&
            (input.category === 'All categories' ||
              r.category === input.category) &&
            [r.name, r.summary, ...r.tags]
              .join(' ')
              .toLowerCase()
              .includes(input.query.toLowerCase()),
        );
        return {
          total: matches.length,
          listings: matches.slice(0, 20).map((r) => ({
            name: r.name,
            url: 'https://ruagentic.com/tools/' + r.slug,
          })),
        };
      }),
    [listings],
  );

  const filtered = listings
    .filter(
      (item) =>
        (kind === 'all' || item.kind === kind) &&
        (category === 'All categories' || item.category === category) &&
        [item.name, item.summary, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    );

  return (
    <div className="directory-shell">
      <main className="catalog-main">
        <section className="catalog-hero">
          <div className="hero-copy">
            <DecodeHeadline />
            <p>
              MCP servers, clients and agentic products with checked Agentic
              files, documentation and connection details.
            </p>
            <button
              type="button"
              className="catalog-search glass"
              onClick={() =>
                window.dispatchEvent(new Event('directory:search'))
              }
              aria-label="Search tools, capabilities, or use cases"
            >
              <CornerBrackets small />
              <Search size={18} aria-hidden="true" />
              <span>Search tools, capabilities, or use cases…</span>
              <kbd>{shortcut}</kbd>
            </button>
            <div className="category-chips">
              {chips.map(([label, value]) => (
                <button
                  type="button"
                  aria-pressed={category === value}
                  key={value}
                  onClick={() =>
                    setCategory(category === value ? 'All categories' : value)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <CheckerDemo />
        </section>
        <div className="catalog-tabs">
          <fieldset className="tab-row">
            <legend className="sr-only">Project type</legend>
            {kinds.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="catalog-controls">
            <label>
              <Search size={12} aria-hidden="true" />
              <span className="sr-only">Filter displayed tools</span>
              <input
                type="search"
                placeholder="FILTER"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              <Tag size={12} aria-hidden="true" />
              <span className="sr-only">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((item) => (
                  <option key={item}>
                    {item === 'All categories' ? 'Category · all' : item}
                  </option>
                ))}
              </select>
              <span className="select-caret" aria-hidden="true">
                ▾
              </span>
            </label>
            <label>
              <SlidersHorizontal size={12} aria-hidden="true" />
              <span className="sr-only">Sort listings</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">Sort · name ↓</option>
                <option value="kind">Sort · type ↓</option>
              </select>
              <span className="select-caret" aria-hidden="true">
                ▾
              </span>
            </label>
            <span className="catalog-count">
              <b>{String(filtered.length).padStart(2, '0')}</b> TOOLS
            </span>
          </div>
        </div>
        <h2 className="sr-only">
          {query
            ? 'Search results'
            : category === 'All categories'
              ? 'All tools'
              : category}
        </h2>
        <div className="listing-grid">
          {filtered.map((item) => (
            <ToolCard
              key={item.slug}
              name={item.name}
              kind={item.kind}
              summary={item.summary}
              source={item.source}
              category={item.category}
              href={'/tools/' + item.slug}
            />
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search size={28} />
            <h2>No matches yet</h2>
            <p>Try a broader search or another category.</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setQuery('');
                setKind('all');
                setCategory('All categories');
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
