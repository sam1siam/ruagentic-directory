/** Badge and embed card for a listing. Everything is a plain SVG or HTML
 *  string built from stored listing fields, so it is unit-testable and can
 *  be served by route handlers. The "verified" wording appears only when
 *  the listing was published through the Agentic Protocol publication
 *  checker, which is what `agenticCheckedAt` records. */
import { kindByValue } from './categories.ts';

export const siteBase = 'https://ruagentic.com';

export type BadgeItem = {
  slug: string;
  name: string;
  kind: string;
  category: string;
  summary: string;
  agenticCheckedAt?: string;
};

export const isVerified = (item: { agenticCheckedAt?: string }) =>
  Boolean(item.agenticCheckedAt);

export const badgeLabel = (verified: boolean) =>
  verified
    ? 'Agentic Protocol verified · Listed on RUAGENTIC'
    : 'Listed on RUAGENTIC';

export const kindLabel = (kind: string) =>
  kindByValue(kind)?.singular ?? 'Listing';

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]!,
  );

const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
const SANS =
  "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
const BG = '#05080c';
const CYAN = '#5ce1e6';
const AMBER = '#ffb020';
const TEXT = '#f2f8fc';
const DIM = '#8fa6b6';
const FAINT = '#5f7a8a';
const LINE = 'rgba(92,225,230,0.35)';

/** The {A} mark, `size` px tall with its top-left corner at (x, y). */
const mark = (x: number, y: number, size: number, color: string) =>
  `<g transform="translate(${x} ${y}) scale(${(size / 40).toFixed(3)})" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">` +
  '<path d="M14 4H9v10l-5 6 5 6v10h5M30 4h5v10l5 6-5 6v10h-5" stroke-width="3"/>' +
  '<path d="M16.5 33.5 22 14l5.5 19.5M18.7 27h6.6" stroke-width="3.2"/></g>';
const markWidth = (size: number) => Math.round(size * 1.1);

/** Uppercase mono label whose width is fixed with textLength so the badge
 *  lays out the same whichever monospace font the viewer has. */
function label(
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  spacing = 1,
) {
  const advance = size * 0.6 + spacing;
  const width = Math.round(text.length * advance - spacing);
  return {
    width,
    svg: `<text x="${x}" y="${y}" textLength="${width}" lengthAdjust="spacing" font-family="${MONO}" font-size="${size}" letter-spacing="${spacing}" fill="${color}">${escapeXml(text)}</text>`,
  };
}

/** Compact 28px badge. Verified listings carry the extra segment. */
export function badgeSvg(verified: boolean) {
  const height = 28;
  const pad = 8;
  const markSize = 16;
  const markY = (height - markSize) / 2;
  let left = pad;
  const parts: string[] = [];
  parts.push(mark(left, markY, markSize, CYAN));
  left += markWidth(markSize);
  if (verified) {
    left += 6;
    const seg = label('AGENTIC PROTOCOL VERIFIED', left, 18, 10, CYAN);
    parts.push(seg.svg);
    left += seg.width;
  }
  left += pad;
  const listed = label('LISTED ON RUAGENTIC', left + pad, 18, 10, BG);
  const rightWidth = listed.width + pad * 2;
  const width = left + rightWidth;
  const title = badgeLabel(verified);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<rect width="${width}" height="${height}" fill="${BG}"/>` +
    `<rect x="${left}" width="${rightWidth}" height="${height}" fill="${CYAN}"/>` +
    parts.join('') +
    listed.svg +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${LINE}"/>` +
    '</svg>'
  );
}

/** Greedy word wrap; the last permitted line is cut with an ellipsis. */
export function wrapLines(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxChars ? word.slice(0, maxChars) : word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const used = lines.slice(0, maxLines);
  const truncated =
    used.join(' ').length < words.join(' ').length && used.length > 0;
  if (truncated) {
    const last = used[used.length - 1]!;
    used[used.length - 1] =
      (last.length > maxChars - 1 ? last.slice(0, maxChars - 1) : last).replace(
        /[\s.,;:]+$/,
        '',
      ) + '…';
  }
  return used;
}

const truncate = (text: string, max: number) =>
  text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;

export const CARD_WIDTH = 480;
export const CARD_HEIGHT = 150;

/** 480×150 card image for READMEs and pages that cannot host an iframe. */
export function cardSvg(item: BadgeItem) {
  const verified = isVerified(item);
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const kind = label(kindLabel(item.kind).toUpperCase(), 0, 0, 9, AMBER, 1.4);
  const kindX = w - 20 - kind.width - 12;
  const kindSvg = label(
    kindLabel(item.kind).toUpperCase(),
    kindX + 6,
    30,
    9,
    AMBER,
    1.4,
  ).svg;
  const category = label(item.category.toUpperCase(), 62, 58, 9.5, FAINT, 1.5);
  const summary = wrapLines(item.summary, 66, 2);
  const status = verified
    ? label('AGENTIC PROTOCOL VERIFIED', 0, 0, 8.5, AMBER, 1.2)
    : label('LISTED ON RUAGENTIC', 0, 0, 8.5, FAINT, 1.2);
  const statusX = w - 20 - status.width - 12;
  // The listing URL must stop short of the status pill.
  const urlChars = Math.floor((statusX - 12 - 20 + 0.4) / (10 * 0.6 + 0.4));
  const url = label(
    truncate(`ruagentic.com/tools/${item.slug}`, urlChars),
    20,
    137,
    10,
    CYAN,
    0.4,
  );
  const statusSvg = label(
    verified ? 'AGENTIC PROTOCOL VERIFIED' : 'LISTED ON RUAGENTIC',
    statusX + 6,
    137,
    8.5,
    verified ? AMBER : FAINT,
    1.2,
  ).svg;
  const title = `${item.name} on RUAGENTIC`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<clipPath id="c"><rect width="${w}" height="${h}"/></clipPath>` +
    `<rect width="${w}" height="${h}" fill="${BG}"/>` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="rgba(255,255,255,0.14)"/>` +
    `<path d="M1 13V1h12M${w - 13} ${h - 1}h12v-12" fill="none" stroke="${CYAN}" stroke-width="1.5"/>` +
    `<g clip-path="url(#c)">` +
    mark(20, 20, 28, CYAN) +
    `<rect x="${kindX}" y="19" width="${kind.width + 12}" height="17" fill="none" stroke="rgba(255,176,32,0.3)"/>` +
    kindSvg +
    `<text x="62" y="39" font-family="${SANS}" font-size="17" font-weight="600" fill="${TEXT}">${escapeXml(truncate(item.name, 40))}</text>` +
    category.svg +
    summary
      .map(
        (line, i) =>
          `<text x="20" y="${86 + i * 18}" font-family="${SANS}" font-size="12.5" fill="${DIM}">${escapeXml(line)}</text>`,
      )
      .join('') +
    `<path d="M20 120.5H${w - 20}" stroke="rgba(255,255,255,0.1)"/>` +
    url.svg +
    `<rect x="${statusX}" y="126" width="${status.width + 12}" height="16" fill="none" stroke="${verified ? 'rgba(255,176,32,0.35)' : 'rgba(255,255,255,0.14)'}"/>` +
    statusSvg +
    '</g></svg>'
  );
}

/** Self-contained page for an iframe: the whole card is one link that opens
 *  the listing in the top window. Fonts fall back to the system stack. */
export function embedHtml(item: BadgeItem) {
  const verified = isVerified(item);
  const page = `${siteBase}/tools/${encodeURIComponent(item.slug)}`;
  const title = `${item.name} on RUAGENTIC`;
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    `<title>${escapeXml(title)}</title>` +
    '<style>' +
    'html,body{margin:0;background:transparent}' +
    `.card{box-sizing:border-box;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto auto;gap:6px 14px;width:${CARD_WIDTH}px;max-width:100%;min-height:${CARD_HEIGHT}px;padding:18px 20px 14px;background:${BG};border:1px solid rgba(255,255,255,0.14);color:${TEXT};font:14px/1.45 ${SANS};text-decoration:none;position:relative}` +
    `.card::before,.card::after{content:"";position:absolute;width:12px;height:12px;border:0 solid ${CYAN}}` +
    '.card::before{top:-1px;left:-1px;border-width:1.5px 0 0 1.5px}.card::after{bottom:-1px;right:-1px;border-width:0 1.5px 1.5px 0}' +
    '.card:hover{border-color:rgba(92,225,230,0.55)}' +
    '.mark{grid-row:1/3;width:31px;height:28px;margin-top:2px}' +
    '.head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;min-width:0}' +
    `.name{font-size:17px;font-weight:600;line-height:1.25;overflow-wrap:anywhere}` +
    `.kind{flex:none;font:9px ${MONO};letter-spacing:1.4px;text-transform:uppercase;color:${AMBER};border:1px solid rgba(255,176,32,0.3);padding:3px 6px;white-space:nowrap}` +
    `.category{font:9.5px ${MONO};letter-spacing:1.5px;text-transform:uppercase;color:${FAINT}}` +
    `.summary{grid-column:1/-1;margin:0;font-size:12.5px;line-height:1.45;color:${DIM};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}` +
    '.foot{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1)}' +
    `.url{font:10px ${MONO};letter-spacing:0.4px;color:${CYAN};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` +
    `.status{flex:none;font:8.5px ${MONO};letter-spacing:1.2px;text-transform:uppercase;padding:3px 6px;border:1px solid ${verified ? 'rgba(255,176,32,0.35)' : 'rgba(255,255,255,0.14)'};color:${verified ? AMBER : FAINT}}` +
    '</style></head><body>' +
    `<a class="card" href="${page}" target="_top" rel="noopener" aria-label="${escapeXml(title)}">` +
    `<svg class="mark" viewBox="0 0 44 40" fill="none" stroke="${CYAN}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4H9v10l-5 6 5 6v10h5M30 4h5v10l5 6-5 6v10h-5" stroke-width="3"/><path d="M16.5 33.5 22 14l5.5 19.5M18.7 27h6.6" stroke-width="3.2"/></svg>` +
    `<div class="head"><span class="name">${escapeXml(item.name)}</span><span class="kind">${escapeXml(kindLabel(item.kind))}</span></div>` +
    `<span class="category">${escapeXml(item.category)}</span>` +
    `<p class="summary">${escapeXml(item.summary)}</p>` +
    `<div class="foot"><span class="url">ruagentic.com/tools/${escapeXml(item.slug)}</span><span class="status">${verified ? 'Agentic Protocol verified' : 'Listed on RUAGENTIC'}</span></div>` +
    '</a></body></html>'
  );
}

/** Copy-paste snippets shown on listing pages and in the dashboard. */
export function badgeSnippets(item: BadgeItem) {
  const slug = encodeURIComponent(item.slug);
  const page = `${siteBase}/tools/${slug}`;
  const badge = `${siteBase}/badge/${slug}.svg`;
  const card = `${siteBase}/embed/${slug}.svg`;
  const frame = `${siteBase}/embed/${slug}`;
  const text = badgeLabel(isVerified(item));
  const title = `${item.name} on RUAGENTIC`;
  return {
    markdownBadge: `[![${text}](${badge})](${page})`,
    htmlBadge: `<a href="${page}"><img src="${badge}" alt="${escapeXml(text)}" height="28"></a>`,
    markdownCard: `[![${title}](${card})](${page})`,
    htmlEmbed: `<iframe src="${frame}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" style="border:0;max-width:100%" loading="lazy" title="${escapeXml(title)}"></iframe>`,
  };
}
