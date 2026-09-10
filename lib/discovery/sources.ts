import { load } from 'cheerio';
import {
  CUTOFF,
  digest,
  publicUrl,
  type Candidate,
  type Snapshot,
  type Source,
} from './policy.ts';
import { readPage } from './http.ts';
import {
  clineCatalog,
  dockerCatalog,
  liteCatalog,
  registryCatalog,
} from './contracts.ts';

const labels: Record<Source, string> = {
  'official-registry': 'Official MCP Registry',
  'mcp-so': 'MCP.so',
  pulsemcp: 'PulseMCP',
  cline: 'Cline Marketplace',
  docker: 'Docker MCP Catalog',
  cursor: 'Cursor Directory',
  microsoft: 'Microsoft MCP list',
  litellm: 'LiteLLM',
  producthunt: 'Product Hunt',
};
export const sourceName = (source: Source) => labels[source];
export const SOURCE_URLS: Record<Source, string> = {
  'official-registry': 'https://registry.modelcontextprotocol.io/v0.1/servers',
  'mcp-so': 'https://mcp.so/sitemap.xml',
  pulsemcp: 'https://www.pulsemcp.com/sitemap.xml',
  cline: 'https://cline.github.io/marketplace/catalog.json',
  docker: 'https://desktop.docker.com/mcp/catalog/v3/catalog.json',
  cursor: 'https://cursor.directory/sitemap.xml',
  microsoft: 'https://raw.githubusercontent.com/microsoft/mcp/main/README.md',
  litellm:
    'https://raw.githubusercontent.com/BerriAI/litellm/main/litellm/proxy/mcp_registry.json',
  producthunt: 'https://www.producthunt.com/feed',
};
const optional = (value: unknown) => publicUrl(value);
const bounded = (s: unknown, n = 2000) =>
  typeof s === 'string' ? s.slice(0, n) : '';
export function parseCline(input: unknown): Candidate[] {
  const value = clineCatalog.parse(input);
  return value.entries
    .filter((r) => r.type === 'mcp')
    .map((r) => ({
      source: 'cline',
      id: String(r.id),
      name: bounded(r.name, 200),
      description: bounded(r.description || r.tagline),
      kind: 'mcp-server',
      sourceUrl:
        'https://github.com/cline/marketplace/tree/main/registry/mcps/' +
        encodeURIComponent(r.id),
      repository: optional(r.repo),
      homepage: optional(r.homepage || r.website),
      endpoint: (r.install?.args || []).map(optional).find(Boolean),
    }));
}
export function parseDocker(input: unknown): Candidate[] {
  const value = dockerCatalog.parse(input);
  return Object.entries(value.registry).map(([id, r]) => {
    return {
      source: 'docker',
      id,
      name: bounded(r.title || id, 200),
      description: bounded(r.description),
      kind: 'mcp-server',
      sourceUrl:
        'https://hub.docker.com/mcp/server/' +
        encodeURIComponent(id) +
        '/overview',
      repository: optional(r.upstream || r.source),
      homepage: optional(r.homepage),
      endpoint: optional(r.remote?.url),
      publishedAt: typeof r.dateAdded === 'string' ? r.dateAdded : undefined,
      dateEvidence: r.dateAdded ? 'Docker catalog dateAdded' : undefined,
    };
  });
}
export function parseLiteLLM(input: unknown): Candidate[] {
  const value = liteCatalog.parse(input);
  return value.servers.map((r) => ({
    source: 'litellm',
    id: String(r.name),
    name: bounded(r.title || r.name, 200),
    description: bounded(r.description),
    kind: 'mcp-server',
    sourceUrl: SOURCE_URLS.litellm,
    endpoint: optional(r.url),
    repository: optional(r.repository),
    homepage: optional(r.homepage),
    registryUrl: optional(r.registry_url),
    npmPackage:
      r.command === 'npx' && Array.isArray(r.args)
        ? r.args.find(
            (a): a is string =>
              typeof a === 'string' &&
              /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(a) &&
              !a.startsWith('-'),
          )
        : undefined,
  }));
}
export function parseMicrosoft(markdown: string): Candidate[] {
  const sections = markdown.split(/^### /m).slice(1);
  const rows: Candidate[] = [];
  for (const section of sections) {
    const name = section
      .split('\n')[0]
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N} .()&+-]/gu, '')
      .trim();
    const repository = section.match(
      /\*\*REPOSITORY\*\*:[^\n]*\]\((https:\/\/[^)]+)\)/,
    )?.[1];
    const description = section.match(/\*\*DESCRIPTION\*\*:\s*([^\n]+)/)?.[1];
    if (!name || !description) continue;
    const homepage = section.match(
      /\*\*(?:DOCUMENTATION|WEBSITE)\*\*:[^\n]*\]\((https:\/\/[^)]+)\)/,
    )?.[1];
    const endpoint = section.match(
      /\*\*TYPE\*\*:[^\n]*`(https:\/\/[^`]+)`/,
    )?.[1];
    rows.push({
      source: 'microsoft',
      id: name.toLowerCase(),
      name,
      description: bounded(description),
      kind: 'mcp-server',
      sourceUrl:
        'https://github.com/microsoft/mcp#' +
        name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, '')
          .replaceAll(' ', '-'),
      repository: optional(repository),
      homepage: optional(homepage),
      endpoint: optional(endpoint),
    });
  }
  if (!rows.length) throw new Error('Microsoft MCP list shape changed');
  return rows;
}
export function parseProductHunt(xml: string): Candidate[] {
  const $ = load(xml, { xml: true });
  if (!$('feed').length) throw new Error('Product Hunt feed shape changed');
  return $('entry')
    .toArray()
    .map((el) => {
      const e = $(el),
        html = load(e.find('content').text()),
        sourceUrl = e.find('link[rel="alternate"]').attr('href') || '',
        published = e.find('published').text();
      const links = html('a[href]')
        .toArray()
        .map((a) => html(a).attr('href'))
        .filter(Boolean) as string[];
      const homepage = links.find((h) => {
        try {
          return !new URL(h).hostname.endsWith('producthunt.com');
        } catch {
          return false;
        }
      });
      return {
        source: 'producthunt',
        id: e.find('id').text(),
        name: bounded(e.find('title').text(), 200),
        description: bounded(html('p').first().text()),
        sourceUrl,
        homepage: optional(homepage),
        publishedAt: published || undefined,
        dateEvidence: published
          ? 'Product Hunt Atom published (updated is ignored)'
          : undefined,
        needsDetail: !homepage,
      };
    });
}
export function parseSitemap(
  xml: string,
  source: Source,
): { sitemaps: string[]; items: Candidate[] } {
  const $ = load(xml, { xml: true });
  const sitemaps = $('sitemap > loc')
    .toArray()
    .map((el) => $(el).text());
  if (!sitemaps.length && !$('urlset').length)
    throw new Error(`${source} sitemap shape changed`);
  const items = $('url > loc')
    .toArray()
    .map((el) => $(el).text())
    .filter((url) => {
      try {
        const u = new URL(url);
        if (source === 'mcp-so')
          return (
            u.hostname === 'mcp.so' &&
            /^\/(servers|agents)\/[^/]+\/?$/.test(u.pathname)
          );
        if (source === 'pulsemcp')
          return (
            ['www.pulsemcp.com', 'pulsemcp.com'].includes(u.hostname) &&
            /^\/(servers|clients)\/[^/]+\/?$/.test(u.pathname)
          );
        return (
          u.hostname === 'cursor.directory' &&
          /^\/(plugins|mcp)\/[^/]+\/?$/.test(u.pathname)
        );
      } catch {
        return false;
      }
    })
    .map(
      (url) =>
        ({
          source,
          id: url,
          name: decodeURIComponent(
            new URL(url).pathname.split('/').filter(Boolean).at(-1)!,
          ).replaceAll('-', ' '),
          description: '',
          sourceUrl: url,
          kind:
            source === 'mcp-so' && url.includes('/agents/')
              ? 'ai-agent'
              : source === 'pulsemcp' && url.includes('/clients/')
                ? 'mcp-client'
                : source === 'cursor'
                  ? undefined
                  : 'mcp-server',
          needsDetail: true,
        }) as Candidate,
    );
  return { sitemaps, items };
}
export function parseDetail(item: Candidate, html: string): Candidate {
  const $ = load(html);
  const metadata =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content');
  const hrefs = $('a[href]')
    .toArray()
    .map((el) => ({
      url: optional($(el).attr('href')),
      label: $(el).text().trim(),
    }))
    .filter((r) => r.url) as { url: string; label: string }[];
  const repository = hrefs.find(
    (r) =>
      /^https:\/\/github.com\/[^/]+\/[^/]+/.test(r.url) &&
      !/\/sponsors\//.test(r.url),
  )?.url;
  const homepage = hrefs.find(
    (r) =>
      /^(?:visit|visit website|website|homepage|learn more|official website|get it|product website)$/i.test(
        r.label,
      ) &&
      !/(producthunt\.com|mcp\.so|pulsemcp\.com|cursor\.directory|github\.com)/i.test(
        new URL(r.url).hostname,
      ),
  )?.url;
  const next = {
    ...item,
    name: bounded($('h1').first().text().trim() || item.name, 200),
    description: bounded(metadata || item.description),
    repository: item.repository || repository,
    homepage: item.homepage || homepage,
    needsDetail: false,
  };
  // dateModified/lastmod never establishes newness. Baseline snapshots are used instead.
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const graph = JSON.parse($(el).text());
      for (const node of Array.isArray(graph) ? graph : [graph]) {
        if (
          node['@type'] === 'SoftwareApplication' &&
          node.datePublished &&
          !next.publishedAt
        ) {
          next.publishedAt = node.datePublished;
          next.dateEvidence = 'Source SoftwareApplication datePublished';
        }
      }
    } catch {}
  }
  return next;
}
async function sitemapSnapshot(
  source: Source,
  deadline: number,
): Promise<Candidate[]> {
  const queue = [SOURCE_URLS[source]],
    visited = new Set<string>(),
    items: Candidate[] = [];
  const root = new URL(SOURCE_URLS[source]);
  while (queue.length) {
    if (visited.size >= 80)
      throw new Error(
        `${source}: sitemap traversal exceeds 80 pages; baseline not committed`,
      );
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    const u = new URL(url);
    if (u.hostname !== root.hostname || u.protocol !== 'https:')
      throw new Error('Sitemap points outside source');
    visited.add(url);
    const page = await readPage(url, deadline);
    const parsed = parseSitemap(page.text, source);
    items.push(...parsed.items);
    for (const child of parsed.sitemaps) {
      if (source === 'mcp-so' && !/[?&]section=(servers|agents)/.test(child))
        continue;
      queue.push(child);
    }
  }
  if (!items.length)
    throw new Error(
      `${source}: empty listing snapshot; baseline not committed`,
    );
  return [...new Map(items.map((i) => [i.id, i])).values()];
}
async function officialSnapshot(
  deadline: number,
  known: Set<string>,
  since: string,
): Promise<Candidate[]> {
  const items: Candidate[] = [],
    cursors = new Set<string>();
  let cursor = '';
  do {
    const u = new URL(SOURCE_URLS['official-registry']);
    u.searchParams.set('limit', '100');
    u.searchParams.set('version', 'latest');
    u.searchParams.set('updated_since', since);
    if (cursor) u.searchParams.set('cursor', cursor);
    const data = registryCatalog.parse(
      JSON.parse((await readPage(u.href, deadline, false)).text),
    );
    for (const entry of data.servers) {
      const s = entry.server,
        m = entry._meta?.['io.modelcontextprotocol.registry/official'];
      if (!s?.name || m?.status !== 'active' || known.has(digest(s.name)))
        continue;
      const published = m.publishedAt;
      if (!published || Date.parse(published) < Date.parse(CUTOFF)) continue;
      // The latest version publication is NOT the first listing date. Check all versions.
      const versions = registryCatalog.parse(
        JSON.parse(
          (
            await readPage(
              `${SOURCE_URLS['official-registry']}/${encodeURIComponent(s.name)}/versions`,
              deadline,
              false,
            )
          ).text,
        ),
      );
      const rows = versions.servers;
      if (!Array.isArray(rows) || versions.metadata?.nextCursor)
        throw new Error('Registry version history incomplete');
      const dates = rows
        .map(
          (r) =>
            r._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt,
        )
        .filter((d): d is string => typeof d === 'string');
      if (dates.length !== rows.length || !dates.length) continue;
      const earliest = dates.sort(
        (a: string, b: string) => Date.parse(a) - Date.parse(b),
      )[0];
      items.push({
        source: 'official-registry',
        id: s.name,
        name: bounded(s.title || s.name.split('/').at(-1), 200),
        description: bounded(s.description),
        kind: 'mcp-server',
        sourceUrl: `https://registry.modelcontextprotocol.io/servers/${encodeURIComponent(s.name)}`,
        homepage: optional(s.websiteUrl),
        repository: optional(s.repository?.url),
        endpoint: optional(s.remotes?.[0]?.url),
        publishedAt: earliest,
        dateEvidence:
          'Earliest publishedAt across complete registry version history',
      });
    }
    cursor = data.metadata?.nextCursor || '';
    if (cursor) {
      if (cursors.has(cursor) || cursors.size >= 100)
        throw new Error('Registry cursor did not terminate');
      cursors.add(cursor);
    }
  } while (cursor);
  return items;
}
export async function fetchSnapshot(
  source: Source,
  deadline: number,
  known = new Set<string>(),
  since = CUTOFF,
): Promise<Snapshot> {
  try {
    let items: Candidate[];
    if (source === 'official-registry')
      items = await officialSnapshot(deadline, known, since);
    else if (['mcp-so', 'pulsemcp', 'cursor'].includes(source))
      items = await sitemapSnapshot(source, deadline);
    else {
      const page = await readPage(
        SOURCE_URLS[source],
        deadline,
        !['cline', 'docker', 'microsoft', 'litellm'].includes(source),
      );
      items =
        source === 'cline'
          ? parseCline(JSON.parse(page.text))
          : source === 'docker'
            ? parseDocker(JSON.parse(page.text))
            : source === 'microsoft'
              ? parseMicrosoft(page.text)
              : source === 'litellm'
                ? parseLiteLLM(JSON.parse(page.text))
                : parseProductHunt(page.text);
      if (!items.length) throw new Error(`${source}: empty catalog`);
    }
    return { source, items, complete: true };
  } catch (error) {
    return {
      source,
      items: [],
      complete: false,
      error: (error as Error).message.slice(0, 200),
    };
  }
}
