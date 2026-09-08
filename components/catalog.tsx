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
  FileText,
  BookOpen,
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
      <main className="catalog-main">
        <section className="catalog-hero">
          <div className="hero-copy">
            <h1>
              Mission control for the <span>agentic stack.</span>
            </h1>
            <p>
              Discover MCP servers, clients, and AI products. Find the
              capabilities, documentation, and connections for your next
              workflow.
            </p>
            <div className="catalog-search">
              <Search size={20} />
              <Input
                aria-label="Search tools"
                placeholder="Search tools, capabilities, or use cases…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ArrowRight size={20} />
            </div>
            <div className="popular-searches">
              {['Developer tools', 'Data & intelligence', 'Automation'].map(
                (item) => (
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
                ),
              )}
            </div>
          </div>
          <aside className="publication-panel glass-panel amber-panel">
            <div className="panel-title">
              <FileJson size={17} />
              <h2>Publication checker</h2>
              <span>FREE PATH</span>
            </div>
            <p>
              Give agents a clear way in. Publish three files, then check them
              as you submit.
            </p>
            <ul>
              {[
                {
                  icon: FileJson,
                  file: 'agentic.json',
                  detail: 'Your machine-readable profile',
                },
                {
                  icon: FileText,
                  file: 'agentic.txt',
                  detail: 'A matching text index',
                },
                {
                  icon: BookOpen,
                  file: 'README.md',
                  detail: 'Project context and Agentic links',
                },
              ].map(({ icon: Icon, file, detail }) => (
                <li key={file}>
                  <Icon size={17} />
                  <div>
                    <strong>{file}</strong>
                    <small>{detail}</small>
                  </div>
                  <span>REQUIRED</span>
                </li>
              ))}
            </ul>
            <Link className="button secondary" href="/submit">
              Check your project <ArrowUpRight size={15} />
            </Link>
            <a className="panel-help" href="https://ruagentic.org/generate/">
              Need the files? Generate them ↗
            </a>
          </aside>
        </section>
        <div className="catalog-metrics" aria-label="Directory counts">
          <span>
            <b>{listings.length}</b> tools in the directory
          </span>
          <span>
            <b>{listings.filter((x) => x.kind === 'server').length}</b> MCP
            servers
          </span>
          <span>
            <b>{listings.filter((x) => x.kind === 'client').length}</b> clients
          </span>
          <span>
            <b>{listings.filter((x) => x.kind === 'product').length}</b>{' '}
            products
          </span>
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
          <div className="catalog-filters">
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
