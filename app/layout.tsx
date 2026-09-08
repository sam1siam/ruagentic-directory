import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import {
  DesignInteractions,
  LightField,
} from '@/components/design-interactions';
import { directoryStats } from '@/lib/server/stats';
import { activeSponsors } from '@/lib/server/sponsors';
import { houseSponsor, pickSponsor } from '@/lib/advertising';
import './globals.css';
import './hud.css';
import './browse.css';
const sans = Instrument_Sans({
  variable: '--font-ui',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const mono = JetBrains_Mono({
  variable: '--font-code',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Stats and sponsors come from the live directory at request time, never from a build snapshot.
  await connection();
  const [stats, sponsors] = await Promise.all([
    directoryStats(),
    activeSponsors(),
  ]);
  const bar = pickSponsor('bar', sponsors) ?? houseSponsor;
  return (
    <html lang="en" className="dark">
      <body className={sans.variable + ' ' + mono.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader stats={stats} sponsor={bar} />
        <DesignInteractions />
        <div id="main">
          <LightField />
          {children}
        </div>
        <SiteFooter stats={stats} />
      </body>
    </html>
  );
}
