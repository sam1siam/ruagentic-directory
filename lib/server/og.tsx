/** Social preview images (Open Graph / Twitter) rendered on demand with
 *  next/og in the site's HUD style. Fonts are fetched from Google Fonts once
 *  per server instance; if that fetch fails the renderer's built-in font is
 *  used so an image is always returned. */
import { ImageResponse } from 'next/og';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: 'normal';
};
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
function googleFont(family: string, weight: number) {
  const key = family + '/' + weight;
  if (!fontCache.has(key))
    fontCache.set(
      key,
      (async () => {
        try {
          const css = await fetch(
            `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
            {
              // An old user agent makes Google Fonts answer with TTF or WOFF sources,
              // both of which the renderer accepts (WOFF2 is not).
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:5.0) Gecko/20100101 Firefox/5.0',
              },
              signal: AbortSignal.timeout(4000),
            },
          ).then((r) => (r.ok ? r.text() : ''));
          const url = css.match(
            /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/,
          )?.[1];
          if (!url) return null;
          const file = await fetch(url, { signal: AbortSignal.timeout(4000) });
          return file.ok ? await file.arrayBuffer() : null;
        } catch {
          return null;
        }
      })(),
    );
  return fontCache.get(key)!;
}
async function fonts(): Promise<Font[]> {
  const [ui, uiBold, code] = await Promise.all([
    googleFont('Instrument Sans', 400),
    googleFont('Instrument Sans', 600),
    googleFont('JetBrains Mono', 400),
  ]);
  const list: Font[] = [];
  if (ui)
    list.push({
      name: 'Instrument Sans',
      data: ui,
      weight: 400,
      style: 'normal',
    });
  if (uiBold)
    list.push({
      name: 'Instrument Sans',
      data: uiBold,
      weight: 600,
      style: 'normal',
    });
  if (code)
    list.push({
      name: 'JetBrains Mono',
      data: code,
      weight: 400,
      style: 'normal',
    });
  return list;
}

const CYAN = '#5ce1e6';
const AMBER = '#ffb020';
const mono = "'JetBrains Mono', monospace";
const sans = "'Instrument Sans', sans-serif";

const truncate = (text: string, max: number) =>
  text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;

export type OgCard = {
  /** Small mono line above the title, e.g. "MCP SERVER · DEVELOPER TOOLS". */
  eyebrow: string;
  title: string;
  description: string;
  /** Mono chips along the bottom, e.g. listing counts. */
  chips?: string[];
  /** Amber chip for a real verification state; never invented. */
  badge?: string;
  /** Shown bottom-right, without the scheme. */
  url: string;
};

function Corner({ style }: { style: Record<string, string | number> }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 42,
        height: 42,
        borderColor: CYAN,
        borderStyle: 'solid',
        borderWidth: 0,
        ...style,
      }}
    />
  );
}

/** Renders the shared card layout as a PNG response. */
export async function ogImage(card: OgCard) {
  const title = truncate(card.title, 90);
  const titleSize = title.length > 60 ? 48 : title.length > 34 ? 60 : 74;
  const description = truncate(card.description, 170);
  const loaded = await fonts();
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '56px 64px',
        background: '#05080c',
        color: '#f2f8fc',
        fontFamily: sans,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -240,
          right: -200,
          width: 720,
          height: 720,
          borderRadius: 360,
          background:
            'radial-gradient(circle, rgba(92,225,230,0.30) 0%, rgba(92,225,230,0) 62%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -300,
          left: -220,
          width: 640,
          height: 640,
          borderRadius: 320,
          background:
            'radial-gradient(circle, rgba(255,176,32,0.16) 0%, rgba(255,176,32,0) 62%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          bottom: 20,
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      />
      <Corner
        style={{ top: 19, left: 19, borderTopWidth: 3, borderLeftWidth: 3 }}
      />
      <Corner
        style={{ top: 19, right: 19, borderTopWidth: 3, borderRightWidth: 3 }}
      />
      <Corner
        style={{
          bottom: 19,
          left: 19,
          borderBottomWidth: 3,
          borderLeftWidth: 3,
        }}
      />
      <Corner
        style={{
          bottom: 19,
          right: 19,
          borderBottomWidth: 3,
          borderRightWidth: 3,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg
          width="48"
          height="44"
          viewBox="0 0 44 40"
          fill="none"
          stroke={CYAN}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M14 4H9v10l-5 6 5 6v10h5M30 4h5v10l5 6-5 6v10h-5"
            strokeWidth="3"
          />
          <path d="M16.5 33.5 22 14l5.5 19.5M18.7 27h6.6" strokeWidth="3.2" />
        </svg>
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 4,
          }}
        >
          RUAGENTIC
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: mono,
            fontSize: 15,
            letterSpacing: 3,
            color: '#5f7a8a',
            border: '1px solid #1c2a35',
            padding: '4px 10px',
          }}
        >
          DIR
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 54,
          fontFamily: mono,
          fontSize: 19,
          letterSpacing: 4,
          color: CYAN,
        }}
      >
        {truncate(card.eyebrow.toUpperCase(), 70)}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 14,
          fontSize: titleSize,
          fontWeight: 600,
          lineHeight: 1.06,
          letterSpacing: -2,
          maxWidth: 1040,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 20,
          fontSize: 27,
          lineHeight: 1.4,
          color: '#c9d6e2',
          maxWidth: 1000,
        }}
      >
        {description}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 'auto',
          fontFamily: mono,
          fontSize: 17,
          letterSpacing: 2.5,
        }}
      >
        {(card.chips ?? []).map((chip) => (
          <div
            key={chip}
            style={{
              display: 'flex',
              padding: '9px 14px',
              border: '1px solid #1c2a35',
              color: '#8fa6b6',
            }}
          >
            {chip.toUpperCase()}
          </div>
        ))}
        {card.badge && (
          <div
            style={{
              display: 'flex',
              padding: '9px 14px',
              border: '1px solid rgba(255,176,32,0.45)',
              color: AMBER,
            }}
          >
            {card.badge.toUpperCase()}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            marginLeft: 'auto',
            color: CYAN,
            letterSpacing: 1,
          }}
        >
          {truncate(card.url, 48)}
        </div>
      </div>
    </div>,
    // An empty font list would disable the renderer's built-in font, so it
    // is only passed when at least one face loaded.
    { ...ogSize, ...(loaded.length ? { fonts: loaded } : {}) },
  );
}
