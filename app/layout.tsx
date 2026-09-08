import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { ArrowUpRight, Braces } from 'lucide-react';
import './globals.css';
import './directory.css';
const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
export const metadata: Metadata = {
  metadataBase: new URL('https://ruagentic.com'),
  title: {
    default: 'RUAGENTIC — MCP servers, clients & agentic AI tools',
    template: '%s · RUAGENTIC',
  },
  description:
    'Discover MCP servers, clients, and agentic AI products. Compare capabilities, find connection details, and submit your project with a paid or verified free listing.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={sans.variable + ' ' + mono.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand-symbol">
              <Braces size={24} />
            </span>
            RUAGENTIC<span className="brand-label">DIRECTORY</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/">Discover</Link>
            <Link href="/collections">Collections</Link>
            <Link href="/pricing">List your project</Link>
            <a href="https://ruagentic.org">
              The convention
              <ArrowUpRight size={12} />
            </a>
          </nav>
          <div className="header-actions">
            <Link href="/login">Sign in</Link>
            <Link href="/submit" className="button primary">
              Submit a project
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        <div id="main">{children}</div>
        <footer className="site-footer">
          <div>
            <Link href="/" className="brand">
              <Braces size={20} />
              RUAGENTIC
            </Link>
            <p>
              The official Agentic directory for agentic AI MCP servers and
              tools.
            </p>
          </div>
          <div className="footer-links">
            <Link href="/about">About</Link>
            <Link href="/guidelines">Listing guidelines</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Contact</Link>
            <a href="https://ruagentic.org">Agentic.org ↗</a>
          </div>
          <p className="footer-note">
            Built for an open agentic ecosystem. Source information and
            verification dates are shown on each listing.
          </p>
        </footer>
      </body>
    </html>
  );
}
