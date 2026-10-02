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
import {
  ALL_CATEGORIES as ALL,
  AUTH_OPTIONS,
  FORK_OPTIONS,
  LAUNCH_OPTIONS,
  PRICING_OPTIONS,
  SORT_OPTIONS,
  STAR_OPTIONS,
  TRANSPORT_OPTIONS,
  activeFilterCount,
  defaultFilters,
  matchesFilters,
  orderListings,
  paramsFromFilters,
  topPlatforms,
  type BrowseFilters,
  type CatalogListing,
} from '@/lib/browse';
export type { CatalogListing } from '@/lib/browse';
type Filters = Partial<BrowseFilters>;

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
  sponsors = [],
  sectionSponsors = {},
  heading,
}: {
  listings: CatalogListing[];
  mode?: 'home' | 'list';
  lock?: { kind?: string; category?: string };
  initial?: Filters;
  /** Sponsored cards shown ahead of the results on list pages. */
  sponsors?: Sponsor[];
  /** Sponsored cards per home section, keyed by kind or category slug. */
  sectionSponsors?: Record<string, Sponsor[]>;
  heading?: { title: string; lead: string; count?: number };
}) {
  const [filters, setFilters] = useState<BrowseFilters>({
    ...defaultFilters,
    ...initial,
    kind: lock.kind ?? initial.kind ?? 'all',
    category: lock.category ?? initial.category ?? ALL,
  });
  const set = (patch: Filters) => setFilters((f) => ({ ...f, ...patch }));
  const [open, setOpen] = useState(false);
  const { q, kind, category, sort } = filters;
  const shortcut = useShortcutLabel();
  useEffect(
    () =>
      registerDirectoryFilter(browserModelContext(), (input) => {
        const applied: BrowseFilters = {
          ...filters,
          q: input.query,
          kind: lock.kind ?? input.kind,
          category: lock.category ?? input.category,
        };
        flushSync(() => setFilters(applied));
        const found = listings.filter((r) => matchesFilters(r, applied));
        return {
          total: found.length,
          listings: found.slice(0, 20).map((r) => ({
            name: r.name,
            url: 'https://ruagentic.com/tools/' + r.slug,
          })),
        };
      }),
    [listings, lock.kind, lock.category, filters],
  );
  // Filters live in the address so a view can be shared or bookmarked;
  // replaceState keeps the back button clean while someone is narrowing down.
  useEffect(() => {
    const query = paramsFromFilters(filters, lock).toString();
    const next = window.location.pathname + (query ? '?' + query : '');
    if (next !== window.location.pathname + window.location.search)
      window.history.replaceState(window.history.state, '', next);
  }, [filters, lock]);
  const results = orderListings(
    listings.filter((item) => matchesFilters(item, filters)),
    sort,
  );
  const active = activeFilterCount(filters, lock) > 0;
  const showFeatured = mode === 'home' && !active;
  const countBy = (fn: (item: CatalogListing) => boolean) =>
    listings.filter(fn).length;
  const reset = () =>
    setFilters({
      ...defaultFilters,
      sort,
      kind: lock.kind ?? 'all',
      category: lock.category ?? ALL,
    });
  // Counts for a choice: what each option would leave within the current
  // type and category, so the numbers answer "how many if I pick this".
  const inScope = listings.filter((i) =>
    matchesFilters(i, { ...defaultFilters, kind, category }),
  );
  const countIf = (patch: Filters) =>
    inScope.filter((i) =>
      matchesFilters(i, { ...defaultFilters, kind, category, ...patch }),
    ).length;
  const choice = (
    title: string,
    key: keyof BrowseFilters,
    options: readonly (readonly [string, string])[],
    note?: string,
  ) => (
    <fieldset className="filter-block" key={key}>
      <legend className="filter-title">{title}</legend>
      <ul className="filter-list">
        {options.map(([value, label]) => (
          <li key={value}>
            <button
              type="button"
              aria-pressed={filters[key] === value}
              onClick={() => set({ [key]: value } as Filters)}
            >
              {label} <b>{countIf({ [key]: value } as Filters)}</b>
            </button>
          </li>
        ))}
      </ul>
      {note && <small className="filter-note">{note}</small>}
    </fieldset>
  );
  const platforms = topPlatforms(inScope);
  const serverish = kind === 'all' || kind === 'server';
  const grid = (
    items: CatalogListing[],
    leads: ReactNode[] = [],
    className?: string,
  ) => (
    <div className={'listing-grid' + (className ? ' ' + className : '')}>
      {leads}
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
              MCP servers, clients, AI agents, skills, plugins, rules and evals
              with checked Agentic Protocol files, documentation and connection
              details.
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
                onChange={(e) => set({ q: e.target.value })}
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
                    onClick={() => set({ kind: 'all' })}
                  >
                    All tools <b>{listings.length}</b>
                  </button>
                </li>
                {kinds.map((k) => (
                  <li key={k.kind}>
                    <button
                      type="button"
                      aria-pressed={kind === k.kind}
                      onClick={() => set({ kind: k.kind })}
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
                    onClick={() => set({ category: ALL })}
                  >
                    All categories <b>{listings.length}</b>
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      aria-pressed={category === c.name}
                      onClick={() => set({ category: c.name })}
                    >
                      {c.name} <b>{countBy((i) => i.category === c.name)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {choice(
            'Launched',
            'launched',
            LAUNCH_OPTIONS,
            'Repository creation date. Projects without a public GitHub repository are not dated.',
          )}
          {choice('Stars', 'stars', STAR_OPTIONS)}
          {choice('Forks', 'forks', FORK_OPTIONS)}
          <fieldset className="filter-block">
            <legend className="filter-title">Sort</legend>
            <ul className="filter-list">
              {SORT_OPTIONS.map(([value, label]) => (
                <li key={value}>
                  <button
                    type="button"
                    aria-pressed={sort === value}
                    onClick={() => set({ sort: value })}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
          {choice('Pricing', 'pricing', PRICING_OPTIONS)}
          <fieldset className="filter-block">
            <legend className="filter-title">Checks</legend>
            <ul className="filter-list">
              <li>
                <button
                  type="button"
                  aria-pressed={filters.verified}
                  onClick={() => set({ verified: !filters.verified })}
                >
                  Agentic Protocol checked <b>{countIf({ verified: true })}</b>
                </button>
              </li>
            </ul>
          </fieldset>
          {platforms.length > 0 && (
            <fieldset className="filter-block">
              <legend className="filter-title">Works with</legend>
              <ul className="filter-list">
                <li>
                  <button
                    type="button"
                    aria-pressed={filters.platform === ''}
                    onClick={() => set({ platform: '' })}
                  >
                    Any <b>{inScope.length}</b>
                  </button>
                </li>
                {platforms.map((p) => (
                  <li key={p.label}>
                    <button
                      type="button"
                      aria-pressed={
                        filters.platform.toLowerCase() === p.label.toLowerCase()
                      }
                      onClick={() => set({ platform: p.label })}
                    >
                      {p.label} <b>{p.count}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {serverish && choice('Transport', 'transport', TRANSPORT_OPTIONS)}
          {serverish && choice('Authentication', 'auth', AUTH_OPTIONS)}
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
              {kinds.map((k) => {
                const items = listings.filter((i) => i.kind === k.kind);
                if (!items.length) return null;
                // Up to four most recent sponsored cards lead each section of eight.
                const leads = (sectionSponsors[k.slug] ?? []).slice(0, 4);
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
                      spotlight(items, featured[k.kind], 8 - leads.length),
                      leads.map((s) => (
                        <SponsorCard sponsor={s} key={'sponsor-' + s.page} />
                      )),
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
                .slice(0, 6)
                .map((c) => {
                  const leads = (sectionSponsors[c.slug] ?? []).slice(0, 4);
                  return (
                    <section className="browse-section" key={c.slug}>
                      <header className="section-head">
                        <h2>
                          {c.name} <b>{c.items.length}</b>
                        </h2>
                        <p>{c.description}</p>
                        <Link href={categoryHref(c)}>View all →</Link>
                      </header>
                      {grid(
                        spotlight(c.items, [], 8 - leads.length),
                        leads.map((s) => (
                          <SponsorCard sponsor={s} key={'sponsor-' + s.page} />
                        )),
                        'featured-grid',
                      )}
                    </section>
                  );
                })}
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
                  sponsors.map((s) => (
                    <SponsorCard sponsor={s} key={'sponsor-' + s.page} />
                  )),
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
