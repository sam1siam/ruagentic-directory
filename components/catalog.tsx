'use client';

import { useState, useEffect } from 'react';

import Link from 'next/link';

import { flushSync } from 'react-dom';

import { registerDirectoryFilter, browserModelContext } from '@/lib/webmcp';

import {
  Search,
  ArrowUpRight,
  Server,
  Monitor,
  Workflow,
  ArrowRight,
  SlidersHorizontal,
  FileJson,
} from 'lucide-react';

import {
  CornerBrackets,
  DecodeHeadline,
} from '@/components/design-interactions';

import { Button } from '@/components/ui/button';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
              Discover MCP servers, clients, and AI products. Find the
              capabilities, documentation, and connections for your next
              workflow.
            </p>
            <button
              type="button"
              className="catalog-search glass-panel"
              onClick={() =>
                window.dispatchEvent(new Event('directory:search'))
              }
              aria-label="Search tools, capabilities, or use cases"
            >
              <CornerBrackets />
              <Search size={20} />
              <span>Search tools, capabilities, or use cases…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="popular-searches">
              {[
                'Developer tools',
                'Data & intelligence',
                'Automation',
                'Search & research',
              ].map((item) => (
                <button
                  aria-pressed={category === item}
                  key={item}
                  onClick={() =>
                    setCategory(category === item ? 'All categories' : item)
                  }
                >
                  {item}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          </div>
          <aside className="publication-panel glass-panel amber-panel">
            <CornerBrackets />
            <div className="panel-title">
              <FileJson size={17} />
              <h2>Publication checker</h2>
              <span>FREE PATH</span>
            </div>
            <p>Five checks for your three Agentic files.</p>
            <ul>
              {[
                'Public JSON profile',
                'Valid profile structure',
                'Matching agentic.txt',
                'Public README.md',
                'README references',
              ].map((label, index) => (
                <li key={label}>
                  <span className="check-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <strong>{label}</strong>
                  <span>REQUIRED</span>
                </li>
              ))}
            </ul>
            <p className="checker-caption">
              Your files are checked when you submit.
            </p>
            <Link className="button secondary" href="/submit">
              Check your project <ArrowUpRight size={15} />
            </Link>
            <a className="panel-help" href="https://ruagentic.org/generate/">
              Need the files? Generate them ↗
            </a>
          </aside>
        </section>
        <div className="catalog-tabs">
          <Tabs value={kind} onValueChange={(value) => setKind(String(value))}>
            <TabsList variant="line">
              <TabsTrigger value="all">All tools</TabsTrigger>
              <TabsTrigger value="server">
                <Server size={15} />
                MCP servers
              </TabsTrigger>
              <TabsTrigger value="client">
                <Monitor size={15} />
                Clients
              </TabsTrigger>
              <TabsTrigger value="product">
                <Workflow size={15} />
                Agentic products
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="catalog-count">{filtered.length} tools</span>
        </div>
        <div className="catalog-section-heading">
          <h2 className="sr-only">
            {query
              ? 'Search results'
              : category === 'All categories'
                ? 'Explore the ecosystem'
                : category}
          </h2>
          <div className="catalog-filters">
            <label className="catalog-inline-filter">
              <Search size={14} />
              <input
                type="search"
                aria-label="Filter displayed tools"
                placeholder="Filter tools…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="sort-control">
              <span className="sr-only">Category</span>
              <select
                aria-label="Filter by category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="sort-control">
              <SlidersHorizontal size={14} />
              <select
                aria-label="Sort listings"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Name A–Z</option>
                <option value="kind">Project type</option>
              </select>
            </label>
          </div>
        </div>
        <div className="listing-grid">
          {filtered.map((item) => (
            <article className="listing-card" key={item.slug}>
              <span className="card-glow" aria-hidden="true" />
              <div className="listing-top">
                <span className="project-monogram">
                  {item.name.slice(0, 2)}
                </span>
                <span className="type-label">
                  {item.kind === 'server'
                    ? 'MCP SERVER'
                    : item.kind === 'client'
                      ? 'MCP CLIENT'
                      : 'AGENTIC PRODUCT'}
                </span>
              </div>
              <Link className="listing-title" href={'/tools/' + item.slug}>
                <h3>{item.name}</h3>
                <ArrowUpRight size={18} />
              </Link>
              <p className="card-summary">{item.summary}</p>
              <div className="listing-bottom">
                <span>{item.source}</span>
                <Link
                  href={'/tools/' + item.slug}
                  aria-label={'View ' + item.name}
                >
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search size={28} />
            <h2>No matches yet</h2>
            <p>Try a broader search or another category.</p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setKind('all');
                setCategory('All categories');
              }}
            >
              Reset filters
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
