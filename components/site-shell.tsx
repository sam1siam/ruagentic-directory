'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { Command } from 'cmdk';
import { Menu, Search, X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { collections, collectionHref } from '@/lib/collections';
import type { DirectoryStats } from '@/lib/server/stats';
import {
  CornerBrackets,
  LightField,
  UtcClock,
  useShortcutLabel,
  useSubmitState,
} from '@/components/design-interactions';

const navigation = [
  ['Discover', '/'],
  ['Collections', '/collections'],
  ['List your project', '/pricing'],
] as const;
const actions = [
  ['Submit a project', '/submit', 'PUBLISH'],
  ['List your project', '/pricing', 'PRICING'],
  ['Browse collections', '/collections', 'CURATED'],
  ['Compare tools', '/compare', 'SIDE BY SIDE'],
  ['Your dashboard', '/dashboard', 'ACCOUNT'],
  ['Developer API & MCP', '/developers', 'API'],
] as const;
const pad = (n: number) => String(n).padStart(2, '0');

function useAccountState() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return;
    const { data } = browserClient().auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session?.user)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function SiteHeader({ stats }: { stats: DirectoryStats }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const signedIn = useAccountState();
  const shortcut = useShortcutLabel();
  const submit = useSubmitState();
  const inSubmit = pathname === '/submit';
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((value) => !value);
      }
    }
    const search = () => setOpen(true);
    document.addEventListener('keydown', key);
    window.addEventListener('directory:search', search);
    return () => {
      document.removeEventListener('keydown', key);
      window.removeEventListener('directory:search', search);
    };
  }, []);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenu(false);
  }
  return (
    <>
      <div className="telemetry-strip" aria-label="Directory telemetry">
        <span className="telemetry-live">
          <i className="live-dot" aria-hidden="true" />
          SYS NOMINAL
        </span>
        <span>
          LISTINGS <b>{pad(stats.total)}</b> <span className="up">▲</span>
        </span>
        <span>
          SERVERS <b>{pad(stats.servers)}</b>
        </span>
        <span>
          CLIENTS <b>{pad(stats.clients)}</b>
        </span>
        <span>
          PRODUCTS <b>{pad(stats.products)}</b>
        </span>
        <span className="telemetry-gap" />
        <UtcClock />
        {stats.lastIndexed && (
          <span className="telemetry-amber">INDEX {stats.lastIndexed}</span>
        )}
      </div>
      <header className={`site-header${inSubmit ? ' submission-header' : ''}`}>
        <Link href="/" className="brand" aria-label="RUAGENTIC directory home">
          <span className="brand-symbol" aria-hidden="true">
            {'{}'}
          </span>
          RUAGENTIC<span className="brand-label">DIR</span>
        </Link>
        {inSubmit ? (
          <>
            <span className="submission-breadcrumb">
              / SUBMIT / <b>{submit.step}</b>
            </span>
            <span className="submission-status" data-state={submit.saved}>
              {submit.saved === 'saved'
                ? 'DRAFT SAVED · ' + submit.at
                : submit.saved === 'dirty'
                  ? 'UNSAVED CHANGES'
                  : 'NEW DRAFT'}
            </span>
            <Link href="/dashboard" className="submission-exit">
              Exit <X size={14} />
            </Link>
          </>
        ) : (
          <>
            <nav
              id="main-navigation"
              aria-label="Main navigation"
              className={'site-nav' + (menu ? ' mobile-open' : '')}
            >
              {navigation.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  {label}
                </Link>
              ))}
              <a href="https://ruagentic.org">The convention ↗</a>
            </nav>
            <div className="header-actions">
              <button
                type="button"
                className="header-search"
                onClick={() => setOpen(true)}
                aria-label="Search the index"
              >
                <Search size={13} />
                <span>Search the index</span>
                <kbd>{shortcut}</kbd>
              </button>
              <Link
                className="header-signin"
                href={signedIn ? '/dashboard' : '/login'}
                aria-current={
                  pathname === '/login' || pathname === '/dashboard'
                    ? 'page'
                    : undefined
                }
              >
                {signedIn ? 'Account' : 'Sign in'}
              </Link>
              <Link href="/submit" className="button primary">
                Submit project →
              </Link>
              <button
                type="button"
                className="mobile-toggle"
                aria-label={menu ? 'Close navigation' : 'Open navigation'}
                aria-expanded={menu}
                aria-controls="main-navigation"
                onClick={() => setMenu(!menu)}
              >
                {menu ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </>
        )}
      </header>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

type Row = {
  id: string;
  kind: string;
  label: string;
  hint: string;
  href: string;
};

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tools, setTools] = useState<
    { name: string; slug: string; category: string; kind: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery('');
  }
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(
          '/api/v1/listings?limit=4&q=' + encodeURIComponent(query),
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (!controller.signal.aborted) setTools(data.listings ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setTools([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  const q = query.trim().toLowerCase();
  const rows = useMemo<Row[]>(
    () => [
      ...tools.map((t) => ({
        id: 'tool:' + t.slug,
        kind: 'TOOL',
        label: t.name,
        hint: t.category,
        href: '/tools/' + t.slug,
      })),
      ...collections
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .map((c) => ({
          id: 'collection:' + c.name,
          kind: 'COLLECTION',
          label: c.name,
          hint: 'kind' in c ? 'Clients' : c.category,
          href: collectionHref(c),
        })),
      ...(q
        ? [
            {
              id: 'filter',
              kind: 'ACTION',
              label: `Filter the directory for “${query.trim()}”`,
              hint: 'DISCOVER',
              href: '/?q=' + encodeURIComponent(query.trim()),
            },
          ]
        : []),
      ...actions
        .filter(([name]) => !q || name.toLowerCase().includes(q))
        .map(([name, href, hint]) => ({
          id: 'action:' + href,
          kind: 'ACTION',
          label: name,
          hint,
          href,
        })),
    ],
    [tools, q, query],
  );
  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="palette-backdrop" />
        <Dialog.Popup
          className="palette"
          aria-label="Search the directory"
          aria-modal="true"
          initialFocus={input}
        >
          <CornerBrackets />
          <Dialog.Title className="sr-only">Search the directory</Dialog.Title>
          <Dialog.Description className="sr-only">
            Type to find a tool, collection or action. Use the arrow keys and
            Enter to open a result.
          </Dialog.Description>
          <Command shouldFilter={false} loop label="Search the directory">
            <div className="palette-head">
              <Search size={16} aria-hidden="true" />
              <Command.Input
                ref={input}
                value={query}
                onValueChange={setQuery}
                placeholder="Search tools, collections, commands…"
              />
              <kbd>ESC</kbd>
            </div>
            <Command.List className="palette-list">
              {loading && !rows.length && (
                <output className="palette-status">SEARCHING…</output>
              )}
              {failed && (
                <p className="palette-status" role="alert">
                  SEARCH UNAVAILABLE · TRY AGAIN SHORTLY
                </p>
              )}
              <Command.Empty className="palette-empty">
                No matching tools, collections or actions.
              </Command.Empty>
              {rows.map((row) => (
                <Command.Item
                  key={row.id}
                  value={row.id}
                  className="palette-item"
                  onSelect={() => go(row.href)}
                >
                  <span className="palette-kind">{row.kind}</span>
                  <span className="palette-label">{row.label}</span>
                  <span className="palette-hint">{row.hint}</span>
                </Command.Item>
              ))}
            </Command.List>
            <div className="palette-foot" aria-hidden="true">
              <span>↑↓ NAV</span>
              <span>⏎ OPEN</span>
              <span>ESC CLOSE</span>
            </div>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SiteFooter({ stats }: { stats: DirectoryStats }) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const command = 'curl ruagentic.com/agentic.json';
  const year = new Date().getFullYear();
  if (pathname === '/')
    return (
      <footer className="site-footer footer-short">
        <span className="footer-brand-mini">{'{}'} RUAGENTIC</span>
        <span>
          Official agentic directory · source and check dates on every listing
        </span>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/guidelines">Guidelines</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="https://ruagentic.org">The convention ↗</a>
        </nav>
      </footer>
    );
  return (
    <footer className="site-footer footer-full">
      <LightField variant="footer" />
      <div className="footer-grid">
        <div className="footer-brand">
          <Link href="/" className="brand">
            <span className="brand-symbol" aria-hidden="true">
              {'{}'}
            </span>
            RUAGENTIC<span className="brand-label">DIR</span>
          </Link>
          <p>
            The official Agentic directory for agentic AI MCP servers and tools.
            Built for an open agentic ecosystem.
          </p>
          <button
            type="button"
            className="footer-command"
            data-copied={copied}
            aria-label="Copy the Agentic profile command"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  'curl https://ruagentic.com/agentic.json',
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                setCopied(false);
              }
            }}
          >
            <span className="prompt" aria-hidden="true">
              $
            </span>
            <code>{command}</code>
            <span className="copy" aria-hidden="true">
              {copied ? '✓' : '⧉'}
            </span>
          </button>
        </div>
        <div className="footer-column">
          <h2>Directory</h2>
          <Link href="/">Discover</Link>
          <Link href="/collections">Collections</Link>
          <Link href="/?kind=server">MCP servers</Link>
          <Link href="/?kind=client">MCP clients</Link>
          <Link href="/?kind=product">Agentic products</Link>
        </div>
        <div className="footer-column">
          <h2>Publish</h2>
          <Link href="/pricing">List your project</Link>
          <Link href="/guidelines">Listing guidelines</Link>
          <a href="https://ruagentic.org/audit/">Publication checker ↗</a>
          <a href="https://ruagentic.org">The convention ↗</a>
          <Link href="/developers">Developer API &amp; MCP</Link>
        </div>
        <div className="footer-column">
          <h2>Company</h2>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/dashboard">Your dashboard</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="telemetry-live">
          <i className="live-dot" aria-hidden="true" />
          ALL SYSTEMS NOMINAL
        </span>
        <span>
          LISTINGS <b>{pad(stats.total)}</b>
        </span>
        {stats.lastIndexed && <span>LAST INDEX {stats.lastIndexed}</span>}
        <span className="telemetry-gap" />
        <span>
          © {year} RUAGENTIC · Source information and check dates are shown on
          each listing
        </span>
      </div>
    </footer>
  );
}
