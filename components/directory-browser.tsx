'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { registerDirectoryFilter, browserModelContext } from '@/lib/webmcp';
import { categories, categoryHref, featured, kinds } from '@/lib/categories';
import type { Sponsor } from '@/lib/advertising';
import {
  CheckerDemo,
  CornerBrackets,
  DecodeHeadline,
  useShortcutLabel,
} from '@/components/design-interactions';
import ToolCard from '@/components/tool-card';
import { SponsorCard } from '@/components/sponsor';

export type CatalogListing = {
  slug: string;
  name: string;
  kind: string;
  summary: string;
  category: string;
  homepage: string;
  tags: string[];
  source: string;
  observedAt: string;
};
type Filters = { q?: string; kind?: string; category?: string; sort?: string };
const ALL = 'All categories';
const sorts = [
  ['name', 'Name'],
  ['kind', 'Type'],
  ['recent', 'Recently indexed'],
] as const;

function matches(item: CatalogListing, f: Required<Filters>) {
  return (
    (f.kind === 'all' || item.kind === f.kind) &&
    (f.category === ALL || item.category === f.category) &&
    [item.name, item.summary, ...item.tags]
      .join(' ')
      .toLowerCase()
      .includes(f.q.toLowerCase())
  );
}
function order(items: CatalogListing[], sort: string) {
  return [...items].sort((a, b) =>
    sort === 'recent'
      ? b.observedAt.localeCompare(a.observedAt) || a.name.localeCompare(b.name)
      : sort === 'kind'
        ? a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
  );
}
/** Featured picks first, then the rest alphabetically. */
function spotlight(items: CatalogListing[], picks: string[], limit: number) {
  const rank = new Map(picks.map((slug, i) => [slug, i]));
  return [...items]
    .sort(
      (a, b) =>
        (rank.get(a.slug) ?? 99) - (rank.get(b.slug) ?? 99) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export default function DirectoryBrowser({
  listings,
  mode = 'list',
  lock = {},
  initial = {},
  sponsor = null,
  categorySponsors = {},
  heading,
}: {
  listings: CatalogListing[];
  mode?: 'home' | 'list';
  lock?: { kind?: string; category?: string };
  initial?: Filters;
  sponsor?: Sponsor | null;
  /** Paid sponsors for the home page category sections, by category slug. */
  categorySponsors?: Record<string, Sponsor>;
  heading?: { title: string; lead: string; count?: number };
}) {
  const [q, setQ] = useState(initial.q ?? ''),
    [kind, setKind] = useState(lock.kind ?? initial.kind ?? 'all'),
    [category, setCategory] = useState(
      lock.category ?? initial.category ?? ALL,
    ),
    [sort, setSort] = useState(initial.sort ?? 'name'),
    [open, setOpen] = useState(false);
  const shortcut = useShortcutLabel();
  const filters = { q, kind, category, sort };
  useEffect(
    () =>
      registerDirectoryFilter(browserModelContext(), (input) => {
        flushSync(() => {
          setQ(input.query);
          if (!lock.kind) setKind(input.kind);
          if (!lock.category) setCategory(input.category);
        });
        const applied = {
          q: input.query,
          kind: lock.kind ?? input.kind,
          category: lock.category ?? input.category,
          sort,
        };
        const found = listings.filter((r) => matches(r, applied));
        return {
          total: found.length,
          listings: found.slice(0, 20).map((r) => ({
            name: r.name,
            url: 'https://ruagentic.com/tools/' + r.slug,
          })),
        };
      }),
    [listings, lock.kind, lock.category, sort],
  );
  const results = order(
    listings.filter((item) => matches(item, filters)),
    sort,
  );
  const active =
    q.trim() !== '' ||
    (!lock.kind && kind !== 'all') ||
    (!lock.category && category !== ALL);
  const showFeatured = mode === 'home' && !active;
  const countBy = (fn: (item: CatalogListing) => boolean) =>
    listings.filter(fn).length;
  const reset = () => {
    setQ('');
    if (!lock.kind) setKind('all');
    if (!lock.category) setCategory(ALL);
  };
  const grid = (
    items: CatalogListing[],
    lead?: ReactNode,
    className?: string,
  ) => (
    <div className={'listing-grid' + (className ? ' ' + className : '')}>
      {lead}
      {items.map((item) => (
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
  );
  return (
    <main className="browse-page">
      {mode === 'home' ? (
        <section className="catalog-hero">
          <div className="hero-copy">
            <DecodeHeadline />
            <p>
              MCP servers, clients and agentic products with checked Agentic
              Protocol files, documentation and connection details.
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
              {kinds.map((k) => (
                <Link key={k.slug} href={'/' + k.slug}>
                  {k.name}
                </Link>
              ))}
              <Link href="/categories">Categories</Link>
            </div>
          </div>
          <CheckerDemo />
        </section>
      ) : (
        heading && (
          <div className="browse-heading">
            <h1>{heading.title}</h1>
            <p className="lead">{heading.lead}</p>
          </div>
        )
      )}
      <div className="browse-layout">
        <button
          type="button"
          className="filter-toggle"
          aria-expanded={open}
          aria-controls="directory-filters"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filters
          {active && <b>ON</b>}
        </button>
        <aside
          id="directory-filters"
          className="filter-panel"
          data-open={open}
          aria-label="Filters"
        >
          <div className="filter-block">
            <label htmlFor="browse-search" className="filter-title">
              Search
            </label>
            <div className="input-shell filter-search">
              <Search size={13} aria-hidden="true" />
              <input
                id="browse-search"
                type="search"
                value={q}
                placeholder="Filter by name, tag, capability…"
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          {!lock.kind && (
            <fieldset className="filter-block">
              <legend className="filter-title">Type</legend>
              <ul className="filter-list">
                <li>
                  <button
                    type="button"
                    aria-pressed={kind === 'all'}
                    onClick={() => setKind('all')}
                  >
                    All tools <b>{listings.length}</b>
                  </button>
                </li>
                {kinds.map((k) => (
                  <li key={k.kind}>
                    <button
                      type="button"
                      aria-pressed={kind === k.kind}
                      onClick={() => setKind(k.kind)}
                    >
                      {k.name} <b>{countBy((i) => i.kind === k.kind)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {!lock.category && (
            <fieldset className="filter-block">
              <legend className="filter-title">Category</legend>
              <ul className="filter-list">
                <li>
                  <button
                    type="button"
                    aria-pressed={category === ALL}
                    onClick={() => setCategory(ALL)}
                  >
                    All categories <b>{listings.length}</b>
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      aria-pressed={category === c.name}
                      onClick={() => setCategory(c.name)}
                    >
                      {c.name} <b>{countBy((i) => i.category === c.name)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <fieldset className="filter-block">
            <legend className="filter-title">Sort</legend>
            <ul className="filter-list">
              {sorts.map(([value, label]) => (
                <li key={value}>
                  <button
                    type="button"
                    aria-pressed={sort === value}
                    onClick={() => setSort(value)}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
          <nav className="filter-block filter-links" aria-label="Browse">
            <span className="filter-title">Browse</span>
            {kinds.map((k) => (
              <Link key={k.slug} href={'/' + k.slug}>
                {k.name} →
              </Link>
            ))}
            <Link href="/categories">All categories →</Link>
            <Link href="/advertise">Sponsor the directory →</Link>
          </nav>
          {active && (
            <button type="button" className="filter-reset" onClick={reset}>
              Reset filters
            </button>
          )}
        </aside>
        <div className="browse-main">
          {showFeatured ? (
            <>
              {kinds.map((k, index) => {
                const items = listings.filter((i) => i.kind === k.kind);
                if (!items.length) return null;
                return (
                  <section className="browse-section" key={k.slug}>
                    <header className="section-head">
                      <h2>
                        {k.name} <b>{items.length}</b>
                      </h2>
                      <p>{k.description}</p>
                      <Link href={'/' + k.slug}>View all →</Link>
                    </header>
                    {grid(
                      spotlight(
                        items,
                        featured[k.kind],
                        sponsor && index === 0 ? 7 : 8,
                      ),
                      sponsor && index === 0 ? (
                        <SponsorCard sponsor={sponsor} key="sponsor" />
                      ) : null,
                      'featured-grid',
                    )}
                  </section>
                );
              })}
              {[...categories]
                .map((c) => ({
                  ...c,
                  items: listings.filter((i) => i.category === c.name),
                }))
                .filter((c) => c.items.length >= 3)
                .sort((a, b) => b.items.length - a.items.length)
                .slice(0, 5)
                .map((c) => (
                  <section className="browse-section" key={c.slug}>
                    <header className="section-head">
                      <h2>
                        {c.name} <b>{c.items.length}</b>
                      </h2>
                      <p>{c.description}</p>
                      <Link href={categoryHref(c)}>View all →</Link>
                    </header>
                    {grid(
                      spotlight(c.items, [], categorySponsors[c.slug] ? 7 : 8),
                      categorySponsors[c.slug] ? (
                        <SponsorCard
                          sponsor={categorySponsors[c.slug]}
                          key="sponsor"
                        />
                      ) : null,
                      'featured-grid',
                    )}
                  </section>
                ))}
            </>
          ) : (
            <section className="browse-section">
              <header className="section-head">
                <h2>
                  {active ? 'Results' : 'All listings'} <b>{results.length}</b>
                </h2>
                {active && (
                  <button type="button" className="text-link" onClick={reset}>
                    Clear filters
                  </button>
                )}
              </header>
              {results.length ? (
                grid(
                  results,
                  sponsor ? (
                    <SponsorCard sponsor={sponsor} key="sponsor" />
                  ) : null,
                )
              ) : (
                <div className="empty-state">
                  <Search size={28} />
                  <h2>No matches yet</h2>
                  <p>Try a broader search or another category.</p>
                  <button type="button" className="button" onClick={reset}>
                    Reset filters
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
