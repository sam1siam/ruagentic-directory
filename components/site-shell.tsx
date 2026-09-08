'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Braces,
  Check,
  Copy,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { browserClient } from '@/lib/supabase/browser';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const navigation = [
  ['Discover', '/'],
  ['Collections', '/collections'],
  ['List your project', '/pricing'],
] as const;
const actions = [
  ['Browse collections', '/collections'],
  ['Submit a project', '/submit'],
  ['Compare tools', '/compare'],
  ['Your dashboard', '/dashboard'],
  ['Developer API & MCP', '/developers'],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
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
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(
          '/api/v1/listings?limit=8&q=' + encodeURIComponent(query),
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data.listings ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  function go(href: string) {
    setOpen(false);
    setMenu(false);
    router.push(href);
  }
  return (
    <>
      <div className="telemetry-strip">
        <span>
          <i /> AGENTIC DIRECTORY
        </span>
        <span>MCP SERVERS / CLIENTS / PRODUCTS</span>
        <a href="https://ruagentic.org">
          OPEN CONVENTION <ArrowUpRight size={11} />
        </a>
      </div>
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Braces size={19} />
          </span>
          RUAGENTIC<span className="brand-label">DIR</span>
        </Link>
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={menu ? 'mobile-open' : ''}
        >
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => setMenu(false)}
            >
              {label}
            </Link>
          ))}
          <a href="https://ruagentic.org">
            The convention <ArrowUpRight size={12} />
          </a>
        </nav>
        <div className="header-actions">
          <Button
            className="header-search"
            variant="outline"
            onClick={() => setOpen(true)}
            aria-label="Search the directory"
          >
            <Search size={14} />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </Button>
          <Link
            className="header-signin"
            href={signedIn ? '/dashboard' : '/login'}
          >
            {signedIn ? 'Account' : 'Sign in'}
          </Link>
          <Link href="/submit" className="button primary">
            Submit <ArrowUpRight size={14} />
          </Link>
          <Button
            className="mobile-toggle"
            variant="ghost"
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menu}
            aria-controls="main-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </Button>
        </div>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="directory-command" showCloseButton={false}>
          <DialogTitle className="sr-only">Search the directory</DialogTitle>
          <DialogDescription className="sr-only">
            Find a tool or page. Use the arrow keys and Enter to open a result.
          </DialogDescription>
          <Command className="hud-command" shouldFilter={false}>
            <CommandInput
              placeholder="Search tools, collections, or actions…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <output className="command-status">Searching…</output>
              )}
              {failed && (
                <p className="command-status" role="alert">
                  Search is unavailable. Try again shortly.
                </p>
              )}
              <CommandEmpty>No matching tools or pages.</CommandEmpty>
              <CommandGroup heading="Tools">
                {results.map((item) => (
                  <CommandItem
                    key={item.slug}
                    value={item.slug}
                    onSelect={() => go('/tools/' + item.slug)}
                  >
                    <Braces size={16} />
                    {item.name}
                    <ArrowUpRight size={14} />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Pages & actions">
                {actions
                  .filter(([name]) =>
                    name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map(([name, href]) => (
                    <CommandItem
                      key={href}
                      value={href}
                      onSelect={() => go(href)}
                    >
                      {name}
                      <ArrowUpRight size={14} />
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="command-footer">
            <span>↑ ↓ navigate · Enter open</span>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Esc / Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SiteFooter() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const command = 'curl https://ruagentic.com/agentic.json';
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link href="/" className="brand">
            <span className="brand-symbol">
              <Braces size={19} />
            </span>
            RUAGENTIC
          </Link>
          <p>
            The official Agentic directory for MCP servers, clients, and agentic
            AI tools.
          </p>
          <div className="footer-command">
            <code>{command}</code>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy Agentic profile command"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(command);
                  setCopied(true);
                  setCopyError(false);
                } catch {
                  setCopyError(true);
                }
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          {copyError && <output>Select the command to copy it.</output>}
        </div>
        <div className="footer-column">
          <h2>Directory</h2>
          <Link href="/?kind=server">MCP servers</Link>
          <Link href="/?kind=client">MCP clients</Link>
          <Link href="/?kind=product">Agentic products</Link>
          <Link href="/collections">Collections</Link>
          <Link href="/compare">Compare tools</Link>
        </div>
        <div className="footer-column">
          <h2>Publish</h2>
          <Link href="/submit">Submit a project</Link>
          <Link href="/pricing">Listing options</Link>
          <Link href="/guidelines">Listing guidelines</Link>
          <Link href="/dashboard">Your dashboard</Link>
          <Link href="/developers">API & MCP</Link>
        </div>
        <div className="footer-column">
          <h2>Company</h2>
          <Link href="/about">About RUAGENTIC</Link>
          <a href="https://ruagentic.org">The Agentic convention ↗</a>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} RUAGENTIC</span>
        <span>Built for an open agentic ecosystem.</span>
        <Link href="/llms.txt">llms.txt ↗</Link>
      </div>
    </footer>
  );
}
