import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import './globals.css';
import './directory.css';
import './hud.css';
const sans = Instrument_Sans({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});
const mono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});
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
        <SiteHeader />
        <div id="main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
