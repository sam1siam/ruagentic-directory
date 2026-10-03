import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import {
  DesignInteractions,
  LightField,
} from '@/components/design-interactions';
import { directoryStats } from '@/lib/server/stats';
import { activeSponsors, sponsorBarSettings } from '@/lib/server/sponsors';
import { pickSponsors } from '@/lib/advertising';
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
/** Real counts in the default title and description; the catalog grows
 *  daily, so the numbers are read at request time. */
export async function generateMetadata(): Promise<Metadata> {
  const s = await directoryStats();
  return {
    metadataBase: new URL('https://ruagentic.com'),
    applicationName: 'RUAGENTIC',
    title: {
      default: `RUAGENTIC — ${s.total}+ MCP servers, AI agents, skills & plugins, updated daily`,
      template: '%s · RUAGENTIC',
    },
    description: `${s.servers} MCP servers, ${s.clients} clients, ${s.products} AI agents, ${s.skills} skills, ${s.plugins} plugins, ${s.rules} rules files and ${s.evals} evals, updated daily. Compare capabilities, find connection details, and list your project free with verified Agentic Protocol files.`,
    // Titles, descriptions and the generated images are filled in per page;
    // the social image comes from the opengraph-image files.
    openGraph: { type: 'website', siteName: 'RUAGENTIC', locale: 'en_US' },
    twitter: { card: 'summary_large_image' },
  };
}
export const viewport: Viewport = { themeColor: '#05080c' };
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Render at request time; public catalog data uses a short shared cache.
  await connection();
  const [stats, sponsors, bar] = await Promise.all([
    directoryStats(),
    activeSponsors(),
    sponsorBarSettings(),
  ]);
  const bars = pickSponsors('bar', sponsors);
  // pickSponsors already falls back to the house sponsors; only an empty
  // sponsor list (storage trouble) leaves nothing to show.
  const barSponsors = bars.length ? bars : sponsors.filter((s) => s.house);
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
