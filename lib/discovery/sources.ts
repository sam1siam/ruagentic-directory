import { load } from 'cheerio';
import { setTimeout as delay } from 'node:timers/promises';
import {
  CUTOFF,
  digest,
  publicUrl,
  type Candidate,
  type Snapshot,
  type Source,
} from './policy.ts';
import { z } from 'zod';
import { ProviderError, apiJson, readPage } from './http.ts';
import { mcpSoMetadata } from './mcp-so.ts';
import {
  clineCatalog,
  dockerCatalog,
  githubSearch,
  hackerNewsItem,
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
  hackernews: 'Hacker News (Show HN)',
  github: 'GitHub',
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
  hackernews: 'https://hacker-news.firebaseio.com/v0/showstories.json',
  github: 'https://api.github.com/search/repositories',
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
  if (item.source === 'mcp-so') {
    const slug = decodeURIComponent(
      new URL(item.sourceUrl).pathname.split('/').filter(Boolean).at(-1)!,
    );
    const metadata = mcpSoMetadata(html, slug);
    // This source's paginated sitemap can reshuffle old entries between reads.
    // Absence alone is not publication evidence; the exact server's date is required.
    next.publishedAt = metadata?.publishedAt;
    next.dateEvidence = metadata
      ? 'MCP.so exact server record createdAt (not updatedAt or sitemap position)'
      : undefined;
    if (metadata?.name) next.name = bounded(metadata.name, 200);
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
type RegistryRead = (
  url: string,
  deadline: number,
) => Promise<{ text: string }>;
type RegistryEntry = ReturnType<
  typeof registryCatalog.parse
>['servers'][number];
const readRegistry: RegistryRead = (url, deadline) =>
  readPage(url, deadline, false);
/** The public registry publishes no rate limit and answers bursts with 429,
 *  so reads stay modest and every reader pauses together when throttled. */
const HISTORY_CONCURRENCY = 4;
const REGISTRY_RETRIES = 4;
/** One server's first publication, from its complete version history.
 *  Undefined when any version is undated, so first publication is unproven. */
async function registryItem(
  entry: RegistryEntry,
  deadline: number,
  read: RegistryRead,
): Promise<Candidate | undefined> {
  const s = entry.server;
  const dates: string[] = [];
  let cursor = '',
    pages = 0;
  do {
    const u = new URL(
      `${SOURCE_URLS['official-registry']}/${encodeURIComponent(s.name)}/versions`,
    );
    if (cursor) u.searchParams.set('cursor', cursor);
    const versions = registryCatalog.parse(
      JSON.parse((await read(u.href, deadline)).text),
    );
    for (const row of versions.servers) {
      const published =
        row._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt;
      if (typeof published !== 'string') return;
      dates.push(published);
    }
    cursor = versions.metadata?.nextCursor || '';
    if (++pages > 20)
      throw new Error('Registry version history did not terminate');
  } while (cursor);
  if (!dates.length) return;
  const earliest = dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0]!;
  return {
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
  };
}
/** Official registry servers updated since `since`. Each new server's full
 *  version history is read, up to four at a time, to find its first
 *  publication. A server whose read fails is left for the next run; when time
 *  runs short the servers already read come back as a partial result. */
export async function officialSnapshot(
  deadline: number,
  known: Set<string>,
  since: string,
  read: RegistryRead = readRegistry,
  sleep: (ms: number) => Promise<unknown> = delay,
): Promise<{ items: Candidate[]; complete: boolean; error?: string }> {
  const items: Candidate[] = [],
    cursors = new Set<string>();
  let cursor = '',
    failed = 0;
  const timeUp = () => Date.now() > deadline - 15_000;
  let pauseUntil = 0;
  /** A 429 or 503 pauses every reader for 2, 4, 8 then 16 seconds and retries
   *  the same read, so throttling delays servers instead of failing them. */
  const politeRead: RegistryRead = async (url) => {
    for (let attempt = 0; ; attempt++) {
      const wait = pauseUntil - Date.now();
      if (wait > 0) {
        if (Date.now() + wait > deadline - 15_000)
          throw new Error('Registry rate limit outlasted the time limit');
        await sleep(wait);
      }
      try {
        return await read(url, deadline);
      } catch (error) {
        const throttled =
          error instanceof ProviderError && [429, 503].includes(error.status);
        if (!throttled || attempt >= REGISTRY_RETRIES) throw error;
        pauseUntil = Math.max(pauseUntil, Date.now() + 2000 * 2 ** attempt);
      }
    }
  };
  const stopped = () => ({
    items,
    complete: false,
    error: 'Registry read stopped at the time limit; progress saved',
  });
  try {
    do {
      if (timeUp()) return stopped();
      const u = new URL(SOURCE_URLS['official-registry']);
      u.searchParams.set('limit', '100');
      u.searchParams.set('version', 'latest');
      u.searchParams.set('updated_since', since);
      if (cursor) u.searchParams.set('cursor', cursor);
      const data = registryCatalog.parse(
        JSON.parse((await politeRead(u.href, deadline)).text),
      );
      const queue = data.servers.filter((entry) => {
        const name = entry.server?.name,
          meta = entry._meta?.['io.modelcontextprotocol.registry/official'];
        return (
          name &&
          meta?.status === 'active' &&
          !known.has(digest(name)) &&
          meta.publishedAt &&
          Date.parse(meta.publishedAt) >= Date.parse(CUTOFF)
        );
      });
      let next = 0,
        outOfTime = false;
      const worker = async () => {
        while (next < queue.length) {
          if (timeUp()) {
            outOfTime = true;
            return;
          }
          const entry = queue[next++]!;
          // The latest version publication is NOT the first listing date.
          try {
            const item = await registryItem(entry, deadline, politeRead);
            if (item) {
              items.push(item);
              known.add(digest(item.id));
            }
          } catch {
            failed++;
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(HISTORY_CONCURRENCY, queue.length) },
          worker,
        ),
      );
      if (outOfTime) return stopped();
      cursor = data.metadata?.nextCursor || '';
      if (cursor) {
        if (cursors.has(cursor) || cursors.size >= 100)
          throw new Error('Registry cursor did not terminate');
        cursors.add(cursor);
      }
    } while (cursor);
  } catch (error) {
    return {
      items,
      complete: false,
      error: (error as Error).message.slice(0, 200),
    };
  }
  return failed
    ? {
        items,
        complete: false,
        error: `${failed} registry server${failed === 1 ? '' : 's'} could not be read; progress saved`,
      }
    : { items, complete: true };
}
/** A Show HN post from the official Hacker News API, dated by its submission
 *  time. Posts without a title, dead or deleted posts and other story types
 *  are ignored; a GitHub link counts as the repository, not a company site. */
export function parseHackerNewsItem(value: unknown): Candidate | undefined {
  const parsed = hackerNewsItem.safeParse(value);
  if (!parsed.success) return;
  const post = parsed.data;
  if (
    post.type !== 'story' ||
    post.dead ||
    post.deleted ||
    !post.time ||
    !post.title ||
    !/^show hn\b/i.test(post.title)
  )
    return;
  const link = optional(post.url);
  const onGithub = Boolean(
    link && /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(link),
  );
  const title = post.title.replace(/^show hn\s*[:–—-]?\s*/i, '').trim();
  const body = post.text ? load(`<div>${post.text}</div>`)('div').text() : '';
  return {
    source: 'hackernews',
    id: String(post.id),
    name: bounded(title.split(/\s+[–—:|-]\s+/)[0] || title, 200),
    description: bounded(`${title}. ${body}`.trim()),
    sourceUrl: `https://news.ycombinator.com/item?id=${post.id}`,
    homepage: onGithub ? undefined : link,
    repository: onGithub ? link : undefined,
    publishedAt: new Date(post.time * 1000).toISOString(),
    dateEvidence: 'Hacker News submission time',
  };
}
/** The latest Show HN posts (the official API keeps about 200, several days'
 *  worth), reading only posts not seen before, eight at a time. */
export async function hackerNewsSnapshot(
  deadline: number,
  known: Set<string>,
  read: RegistryRead = readRegistry,
): Promise<{ items: Candidate[]; complete: boolean; error?: string }> {
  const ids = z
    .array(z.number())
    .parse(JSON.parse((await read(SOURCE_URLS.hackernews, deadline)).text));
  const queue = ids.filter((id) => !known.has(digest(String(id))));
  const items: Candidate[] = [];
  let next = 0,
    failed = 0,
    outOfTime = false;
  const worker = async () => {
    while (next < queue.length) {
      if (Date.now() > deadline - 15_000) {
        outOfTime = true;
        return;
      }
      const id = queue[next++]!;
      try {
        const item = parseHackerNewsItem(
          JSON.parse(
            (
              await read(
                `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
                deadline,
              )
            ).text,
          ),
        );
        if (item) items.push(item);
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker));
  if (outOfTime)
    return {
      items,
      complete: false,
      error: 'Hacker News read stopped at the time limit; progress saved',
    };
  return failed
    ? {
        items,
        complete: false,
        error: `${failed} Hacker News post${failed === 1 ? '' : 's'} could not be read; progress saved`,
      }
    : { items, complete: true };
}
const GITHUB_TOPICS = ['mcp-server', 'model-context-protocol'] as const;
/** New, non-fork, non-archived repositories from one search results page,
 *  dated by their creation time. */
export function parseGithubSearch(value: unknown, topic: string): Candidate[] {
  return githubSearch
    .parse(value)
    .items.filter(
      (repo) =>
        !repo.fork &&
        !repo.archived &&
        Date.parse(repo.created_at) >= Date.parse(CUTOFF),
    )
    .map((repo) => ({
      source: 'github',
      id: repo.full_name.toLowerCase(),
      name: bounded(repo.name, 200),
      description: bounded(repo.description ?? ''),
      kind:
        topic === 'mcp-server' || repo.topics?.includes('mcp-server')
          ? 'mcp-server'
          : undefined,
      sourceUrl: repo.html_url,
      repository: optional(repo.html_url),
      homepage: optional(repo.homepage),
      publishedAt: repo.created_at,
      dateEvidence: 'GitHub repository creation time',
    }));
}
type GithubApi = (
  url: string,
  init: RequestInit,
  deadline: number,
) => Promise<unknown>;
/** Repositories tagged as MCP servers created since `since`, through GitHub's
 *  repository search API. Paced by the provider pacer (10 searches a minute
 *  without GITHUB_TOKEN); stops with a partial result on errors. */
export async function githubSnapshot(
  deadline: number,
  known: Set<string>,
  since: string,
  api: GithubApi = apiJson,
): Promise<{ items: Candidate[]; complete: boolean; error?: string }> {
  const found = new Map<string, Candidate>();
  const created = new Date(since).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RUAGENTIC-Directory/1.0 (+https://ruagentic.com/about)',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
  try {
    for (const topic of GITHUB_TOPICS) {
      for (let page = 1; page <= 10; page++) {
        const u = new URL(SOURCE_URLS.github);
        u.searchParams.set(
          'q',
          `topic:${topic} created:>=${created} fork:false archived:false`,
        );
        u.searchParams.set('sort', 'updated');
        u.searchParams.set('per_page', '100');
        u.searchParams.set('page', String(page));
        const data = githubSearch.parse(
          await api(u.href, { headers }, deadline),
        );
        if (data.total_count > 1000)
          throw new Error(
            `GitHub topic ${topic} has more than 1,000 new repositories in the window`,
          );
        for (const item of parseGithubSearch(data, topic))
          if (!known.has(digest(item.id)) && !found.has(item.id))
            found.set(item.id, item);
        if (data.items.length < 100) break;
      }
    }
  } catch (error) {
    return {
      items: [...found.values()],
      complete: false,
      error: (error as Error).message.slice(0, 200),
    };
  }
  return { items: [...found.values()], complete: true };
}
export async function fetchSnapshot(
  source: Source,
  deadline: number,
  known = new Set<string>(),
  since = CUTOFF,
): Promise<Snapshot> {
  try {
    let items: Candidate[];
    if (
      source === 'official-registry' ||
      source === 'hackernews' ||
      source === 'github'
    ) {
      const result =
        source === 'official-registry'
          ? await officialSnapshot(deadline, known, since)
          : source === 'hackernews'
            ? await hackerNewsSnapshot(deadline, known)
            : await githubSnapshot(deadline, known, since);
      return result.complete
        ? { source, items: result.items, complete: true }
        : {
            source,
            items: result.items,
            complete: false,
            partial: true,
            error: result.error,
          };
    } else if (['mcp-so', 'pulsemcp', 'cursor'].includes(source))
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
