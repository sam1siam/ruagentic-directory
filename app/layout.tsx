import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import {
  DesignInteractions,
  LightField,
} from '@/components/design-interactions';
import { directoryStats } from '@/lib/server/stats';
import { activeSponsors, sponsorBarSettings } from '@/lib/server/sponsors';
import { houseSponsor, pickSponsors } from '@/lib/advertising';
import { gtmNoscriptSrc, gtmScript } from '@/lib/analytics';
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
  const [stats, sponsors, bar] = await Promise.all([
    directoryStats(),
    activeSponsors(),
    sponsorBarSettings(),
  ]);
  const bars = pickSponsors('bar', sponsors);
  const barSponsors = bars.length ? bars : [houseSponsor];
  return (
    <html lang="en" className="dark">
      <head>
        {/* Google Tag Manager */}
        <script id="gtm" dangerouslySetInnerHTML={{ __html: gtmScript }} />
        {/* End Google Tag Manager */}
      </head>
      <body className={sans.variable + ' ' + mono.variable}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={gtmNoscriptSrc}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader
          stats={stats}
          sponsors={barSponsors}
          barInterval={bar.intervalSeconds}
        />
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
