import { prepareCatalog } from '../catalog-import.ts';
import { cleanUrl, type ListingInput, type PublicListing } from '../listing.ts';
import { digest, type Candidate } from './policy.ts';
import { sourceName } from './sources.ts';

export type ListingKind =
  | 'server'
  | 'client'
  | 'product'
  | 'skill'
  | 'plugin'
  | 'rules'
  | 'eval';
const singular: Record<ListingKind, string> = {
  server: 'an MCP server',
  client: 'an MCP client',
  product: 'an AI agent',
  skill: 'a skill',
  plugin: 'a plugin',
  rules: 'a rules file',
  eval: 'an eval',
};
const tagsFor: Record<ListingKind, string[]> = {
  server: ['mcp'],
  client: ['mcp'],
  product: ['ai-agent'],
  skill: ['skill'],
  plugin: ['plugin'],
  rules: ['rules'],
  eval: ['eval', 'benchmark'],
};
const packaged = (kind: ListingKind) =>
  kind === 'skill' || kind === 'plugin' || kind === 'rules' || kind === 'eval';
const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The directory kind for a candidate: the source's own classification
 *  first, otherwise the project's own words. Nothing else is inferred. */
export function listingKind(item: Candidate): ListingKind | undefined {
  if (item.kind === 'mcp-server') return 'server';
  if (item.kind === 'mcp-client') return 'client';
  if (item.kind === 'ai-agent') return 'product';
  if (item.kind) return item.kind;
  const text = `${item.name} ${item.description}`;
  if (/\bMCP clients?\b/i.test(text)) return 'client';
  if (/\bMCP\b|model context protocol/i.test(text)) return 'server';
  if (/\bagents?\b|\bagentic\b/i.test(text)) return 'product';
  return;
}
/** Category suggestions from the project's own description, in the same
 *  spirit as the bundled catalog's editorial suggestions. The owner can
 *  correct the category by claiming the listing. */
const CATEGORY_RULES: [RegExp, string][] = [
  [
    /\b(browser|scrap\w*|playwright|puppeteer|crawl\w*)\b/i,
    'Browser & web automation',
  ],
  [
    /\b(search|retriev\w*|research|arxiv|wikipedia|knowledge base)\b/i,
    'Search & research',
  ],
  [
    /\b(database|postgres\w*|mysql|sqlite|vector|analytics|warehouse|bigquery|snowflake|supabase|mongodb|redis|clickhouse)\b/i,
    'Data & intelligence',
  ],
  [
    /\b(email|gmail|slack|discord|telegram|whatsapp|sms|messaging|messages)\b/i,
    'Communication',
  ],
  [
    /\b(crm|helpdesk|help desk|tickets?|sales|zendesk|hubspot|salesforce|intercom)\b/i,
    'Customer support & sales',
  ],
  [/\b(seo|marketing|campaigns?|advertis\w*)\b/i, 'Marketing & SEO'],
  [/\b(design|figma|canva|cms|writing|blog)\b/i, 'Design & content'],
  [
    /\b(images?|audio|speech|voice|video|music|tts|podcasts?)\b/i,
    'Media, audio & video',
  ],
  [
    /\b(cloud|kubernetes|k8s|docker|deploy\w*|monitor\w*|observab\w*|logging|aws|azure|gcp|terraform|devops|infrastructure)\b/i,
    'Infrastructure',
  ],
  [
    /\b(security|auth\w*|secrets?|vulnerab\w*|compliance|identity|passwords?)\b/i,
    'Security & identity',
  ],
  [
    /\b(payments?|stripe|bank\w*|accounting|invoic\w*|crypto|trading|stocks?|finance|financial)\b/i,
    'Finance',
  ],
  [
    /\b(e-?commerce|shopify|storefront|cart|orders|woocommerce)\b/i,
    'E-commerce',
  ],
  [
    /\b(health|medical|clinical|biolog\w*|genom\w*|chemistry|science|scientific)\b/i,
    'Science & health',
  ],
  [/\b(games?|gaming|unity|unreal|3d|blender|minecraft)\b/i, 'Gaming & 3D'],
  [
    /\b(maps?|geo\w*|weather|travel|flights?|transit|location)\b/i,
    'Location & travel',
  ],
  [
    /\b(tasks?|todo|calendar|notes?|notion|documents?|spreadsheets?|productivity)\b/i,
    'Productivity',
  ],
  [/\b(workflows?|automation|zapier|n8n|integrations?|rpa)\b/i, 'Automation'],
  [
    /\b(llms?|language models?|inference|embeddings?|prompts?|openai|anthropic|gemini|memory|evaluation|rag)\b/i,
    'AI & language models',
  ],
  [
    /\b(code|coding|git|github|ide|repositor\w*|ci|tests?|testing|debug\w*|developers?|api|sdk|cli|terminal)\b/i,
    'Developer tools',
  ],
];
export function suggestCategory(text: string) {
  for (const [pattern, category] of CATEGORY_RULES)
    if (pattern.test(text)) return category;
  return 'Other';
}
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}
/** A slug nobody holds yet: the name, then the name plus a short digest of
 *  the source record when another project already uses that name. */
export function uniqueSlug(item: Candidate, taken: Set<string>) {
  const base =
    slugify(item.name) || `${item.source}-${digest(item.id).slice(0, 8)}`;
  if (!taken.has(base)) return base;
  const suffix = digest(`${item.source}:${item.id}`).slice(0, 6);
  let slug = `${base}-${suffix}`;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${suffix}-${n}`;
  return slug;
}
const safeUrl = (value?: string) => {
  if (!value) return '';
  try {
    const u = new URL(value);
    u.search = '';
    u.hash = '';
    return cleanUrl(u.href);
  } catch {
    return '';
  }
};
function summaryOf(
  text: string,
  name: string,
  kind: ListingKind,
  source: string,
) {
  const sentence = /^(.{20,}?[.!?])(?:\s|$)/.exec(text)?.[1] ?? text;
  let summary = sentence.trim();
  if (summary.length > 240) {
    summary = summary.slice(0, 240);
    const cut = summary.lastIndexOf(' ');
    if (cut > 120) summary = summary.slice(0, cut);
    summary = summary.replace(/[\s,;:(-]+$/, '') + '…';
  }
  if (summary.length >= 20) return summary;
  return `${name} is ${singular[kind]} first seen on ${source}.`.slice(0, 240);
}
/** A directory listing from a qualified candidate. Every field is the
 *  source's data or a plain statement of where it came from; the kind and
 *  category are classifications of the project's own description. Throws
 *  when the listing schema rejects the data, so the caller can hold the
 *  candidate for review instead of publishing something malformed. */
export function listingFromCandidate(
  item: Candidate,
  now: string,
  taken: Set<string>,
): { slug: string; data: PublicListing; visible: boolean } {
  const kind = listingKind(item);
  if (!kind)
    throw new Error(
      'Could not tell whether this is an MCP server, MCP client or AI agent',
    );
  const source = sourceName(item.source),
    name = clean(item.name).slice(0, 100),
    text = clean(item.description).slice(0, 5000),
    seen = item.publishedAt ? item.publishedAt.slice(0, 10) : now.slice(0, 10);
  // The description is the source's own text; where it is too short for the
  // schema, a plain statement of what and where it is stands in. Provenance
  // lives in `sources`, and the page offers a Claim button instead.
  const fallback = `${name} is ${singular[kind]} first seen on ${source} on ${seen}. See its website and repository for details.`;
  const input: ListingInput = {
    kind,
    name,
    summary: summaryOf(text, name, kind, source),
    description:
      text.length >= 60 ? text : [text, fallback].filter(Boolean).join(' '),
    homepage:
      safeUrl(item.homepage) ||
      (packaged(kind) ? safeUrl(item.repository) : ''),
    repository: safeUrl(item.repository),
    documentation: '',
    endpoint: safeUrl(item.endpoint),
    category: suggestCategory(`${name} ${text}`) as ListingInput['category'],
    tags: tagsFor[kind],
    pricing: 'unknown',
    transport: kind === 'server' ? 'unknown' : 'not-applicable',
    authentication: kind === 'server' ? 'unknown' : 'not-applicable',
    platforms: [],
    license: '',
    setup: '',
    capabilities: [],
    profileUrl: '',
    readmeUrl: '',
    agentCard: '',
    agentProtocol: '',
    fileUrl: '',
    allowedTools: '',
  };
  const slug = uniqueSlug(item, taken);
  const [row] = prepareCatalog(
    [
      {
        ...input,
        slug,
        source,
        sourceUrl: item.sourceUrl,
        observedAt: now,
        publishedAt: item.publishedAt || '',
        imported: true,
        submitted: false,
        ownershipVerified: false,
        sources: [
          {
            kind: 'automated-discovery',
            url: item.sourceUrl,
            observedAt: now,
            ...(item.dateEvidence ? { dateEvidence: item.dateEvidence } : {}),
            fields: [
              'name',
              'description',
              'homepage',
              'repository',
              'endpoint',
            ],
          },
          {
            kind: 'editorial-normalization',
            observedAt: now,
            notes: [
              'Kind and category are classifications of the source description; the owner can correct them by claiming the listing.',
            ],
          },
        ],
      },
    ],
    now,
  );
  // Optional provenance keys the import path leaves undefined are dropped,
  // so the stored object holds only what is known.
  const data = Object.fromEntries(
    Object.entries(row!.data).filter(([, value]) => value !== undefined),
  ) as PublicListing;
  return { slug, data, visible: true };
}
