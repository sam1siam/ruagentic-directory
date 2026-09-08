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
  Globe,
  Braces,
} from 'lucide-react';

import { Input } from '@/components/ui/input';

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
      <aside className="directory-sidebar">
        <p className="nav-caption">EXPLORE THE DIRECTORY</p>
        <Link className="side-link selected" href="/">
          <Globe size={17} />
          All tools<span>↗</span>
        </Link>
        <Link className="side-link" href="/?kind=server">
          <Server size={17} />
          MCP servers
        </Link>
        <Link className="side-link" href="/?kind=client">
          <Monitor size={17} />
          MCP clients
        </Link>
        <Link className="side-link" href="/?kind=product">
          <Workflow size={17} />
          Agentic products
        </Link>
        <p className="nav-caption category-caption">BROWSE BY CATEGORY</p>
        {categories.map((item) => (
          <button
            className={'category-link ' + (category === item ? 'active' : '')}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
        <div className="sidebar-guide">
          <Braces size={22} />
          <strong>Make your project agent-readable.</strong>
          <p>Publish your Agentic files and qualify for a free listing.</p>
          <a href="https://ruagentic.org/generate/">
            Generate your files <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <main className="catalog-main">
        <div className="catalog-intro">
          <span className="overline">
            <span className="live-dot" /> THE AGENTIC TOOL DIRECTORY
          </span>
          <h1>
            Find the tools.
            <br />
            <span>Build what’s next.</span>
          </h1>
          <p>
            MCP servers, clients, and agentic products.
            <br className="desktop-break" /> One place to discover what belongs
            in your workflow.
          </p>
        </div>
        <div className="catalog-search">
          <Search size={21} />
          <Input
            aria-label="Search tools"
            placeholder="Search tools, capabilities, or use cases…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌕</kbd>
        </div>
        <div className="popular-searches">
          <span>Explore</span>
          {['Developer tools', 'Data & intelligence', 'Automation'].map(
            (item) => (
              <button key={item} onClick={() => setCategory(item)}>
                {item}
                <ArrowUpRight size={12} />
              </button>
            ),
          )}
        </div>
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
          <h2>
            {query
              ? 'Search results'
              : category === 'All categories'
                ? 'Explore the ecosystem'
                : category}
          </h2>
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
        <div className="listing-grid">
          {filtered.map((item) => (
            <article className="listing-card" key={item.slug}>
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
              <div className="listing-tags">
                {item.tags.slice(0, 2).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
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
        <section className="catalog-publish">
          <div>
            <span className="overline">BUILT SOMETHING USEFUL?</span>
            <h2>Put it in front of the right agents.</h2>
            <p>
              Submit your project in a few steps. Pay once, or publish your
              Agentic files for a free listing.
            </p>
          </div>
          <Link className="button primary" href="/submit">
            List your project
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
    </div>
  );
}
