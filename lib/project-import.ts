import { cleanUrl, categories, type ListingInput } from './listing.ts';

export type ImportField = keyof ListingInput;
export type ImportEvidence = {
  field: ImportField;
  url: string;
  source: string;
};
export type ImportResult = {
  suggestions: Partial<ListingInput>;
  evidence: ImportEvidence[];
  observations: {
    url: string;
    status: 'read' | 'unavailable';
    detail: string;
  }[];
  missing: string[];
  notice: string;
};
export const fieldNames: Partial<Record<ImportField, string>> = {
  name: 'Project name',
  summary: 'Short description',
  description: 'About the project',
  homepage: 'Homepage',
  repository: 'Repository',
  documentation: 'Documentation',
  endpoint: 'MCP endpoint',
  tags: 'Tags',
  category: 'Category',
  setup: 'Setup instructions',
  capabilities: 'Capabilities',
  license: 'License',
  profileUrl: 'Agentic profile',
  readmeUrl: 'README',
  transport: 'Transport',
  authentication: 'Authentication',
};

export function plain(value: unknown, limit = 6000): string {
  if (typeof value !== 'string') return '';
  return (
    value
      .slice(0, 262144)
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,
        '',
      )
      .replace(/<[^>]{0,8192}>/g, ' ')
      .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, raw: string) => {
        const n =
          raw[0].toLowerCase() === 'x'
            ? parseInt(raw.slice(1), 16)
            : Number(raw);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
      })
      .replace(
        /&(?:amp|quot|apos|lt|gt|nbsp);/g,
        (s) =>
          ({
            '&amp;': '&',
            '&quot;': '"',
            '&apos;': "'",
            '&lt;': '<',
            '&gt;': '>',
            '&nbsp;': ' ',
          })[s] ?? '',
      )
      // Strip control and bidirectional override characters from public metadata.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit)
  );
}
export function publicLink(value: unknown, base: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048)
    return '';
  try {
    return cleanUrl(new URL(value, base).href);
  } catch {
    return '';
  }
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
function attrs(tag: string) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(
      (m) => [m[1].toLowerCase(), plain(m[2] ?? m[3] ?? m[4], 4096)],
    ),
  );
}
export function extractDocument(
  text: string,
  contentType: string,
  url: string,
) {
  const suggestions: Partial<ListingInput> = {};
  const links: {
    url: string;
    type: 'documentation' | 'repository' | 'readme' | 'profile';
  }[] = [];
  const input = text.slice(0, 262144);
  const addLink = (raw: unknown, type: (typeof links)[number]['type']) => {
    const value = publicLink(raw, url);
    if (value && !links.some((x) => x.url === value))
      links.push({ url: value, type });
  };
  function structured(raw: unknown) {
    const data = record(raw);
    const type = data['@type'];
    if (
      ['SoftwareApplication', 'WebApplication', 'SoftwareSourceCode'].includes(
        String(type),
      )
    ) {
      if (!suggestions.name) suggestions.name = plain(data.name, 100);
      if (!suggestions.summary)
        suggestions.summary = plain(data.description, 240);
      const license = publicLink(data.license, url) || plain(data.license, 80);
      if (license) suggestions.license = license.slice(0, 80);
      addLink(data.codeRepository, 'repository');
    }
    if (Array.isArray(data['@graph']))
      for (const item of data['@graph'].slice(0, 20)) {
        const child = { ...record(item) };
        delete child['@graph'];
        structured(child);
      }
  }
  if (/json/i.test(contentType) || /\.json$/i.test(new URL(url).pathname)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      return { suggestions, links };
    }
    const data = record(parsed);
    structured(data);
    if (data.openapi) {
      const info = record(data.info);
      suggestions.name = plain(info.title, 100);
      suggestions.summary = plain(info.description, 240);
      suggestions.description = plain(info.description);
      const paths = record(data.paths),
        caps: string[] = [];
      for (const path of Object.values(paths).slice(0, 50))
        for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
          const operation = record(record(path)[method]);
          const label = plain(operation.summary || operation.description, 100);
          if (label && caps.length < 20) caps.push(label);
        }
      if (caps.length) suggestions.capabilities = [...new Set(caps)];
      addLink(record(data.externalDocs).url, 'documentation');
    } else if (data.agentic && Array.isArray(data.actions)) {
      if (
        typeof data.origin !== 'string' ||
        publicLink(data.origin, url) !== new URL(url).origin + '/'
      )
        return { suggestions: {}, links: [] };
      suggestions.profileUrl = url;
      suggestions.capabilities = data.actions
        .slice(0, 20)
        .map((a) => plain(record(a).description || record(a).id, 100))
        .filter((x) => x.length >= 2);
      const docs = data.actions
        .map((a) => publicLink(record(a).openapi, url))
        .find(Boolean);
      if (docs) addLink(docs, 'documentation');
    } else if (
      data.name &&
      data.description &&
      (data.packages || data.remotes || data['$schema'])
    ) {
      suggestions.name = plain(data.title || data.name, 100);
      suggestions.summary = plain(data.description, 240);
      suggestions.description = plain(data.description);
      suggestions.homepage = publicLink(data.websiteUrl, url);
      addLink(record(data.repository).url, 'repository');
      if (Array.isArray(data.remotes))
        for (const raw of data.remotes.slice(0, 10)) {
          const remote = record(raw),
            endpoint = publicLink(remote.url, url);
          if (
            endpoint &&
            ['streamable-http', 'sse'].includes(String(remote.type))
          ) {
            suggestions.endpoint = endpoint;
            suggestions.transport = remote.type as ListingInput['transport'];
            break;
          }
        }
    }
  } else if (
    /html/i.test(contentType) ||
    /^\s*<!doctype html|^\s*<html/i.test(input)
  ) {
    const meta: Record<string, string> = {};
    for (const tag of input.match(/<meta\b[^>]{0,8192}>/gi) ?? []) {
      const a = attrs(tag);
      if (a.content)
        meta[(a.property || a.name || '').toLowerCase()] = a.content;
    }
    suggestions.name = plain(
      meta['og:site_name'] ||
        meta['og:title'] ||
        input.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      100,
    );
    suggestions.summary = plain(
      meta.description || meta['og:description'] || meta['twitter:description'],
      240,
    );
    for (const match of [
      ...input.matchAll(/<script\b([^>]{0,2000})>([\s\S]*?)<\/script\s*>/gi),
    ].slice(0, 30)) {
      if (!/application\/ld\+json/i.test(match[1]) || match[2].length > 32768)
        continue;
      try {
        const data = JSON.parse(match[2]);
        for (const item of Array.isArray(data) ? data.slice(0, 20) : [data])
          structured(item);
      } catch {}
    }
    const paragraphs = [
      ...input
        .replace(
          /<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<nav\b[^>]*>[\s\S]*?<\/nav\s*>|<footer\b[^>]*>[\s\S]*?<\/footer\s*>/gi,
          '',
        )
        .matchAll(/<p\b[^>]{0,4096}>([\s\S]{0,12000}?)<\/p\s*>/gi),
    ]
      .map((m) => plain(m[1], 1000))
      .filter((x) => x.length >= 60)
      .slice(0, 4);
    suggestions.description = [
      ...new Set([suggestions.summary, ...paragraphs].filter(Boolean)),
    ]
      .join('\n\n')
      .slice(0, 6000);
    if (meta.keywords)
      suggestions.tags = meta.keywords
        .split(',')
        .map((x) => plain(x, 30))
        .filter(Boolean)
        .slice(0, 8);
    for (const m of [
      ...input.matchAll(/<a\b([^>]{0,8192})>([\s\S]{0,1500}?)<\/a\s*>/gi),
    ].slice(0, 250)) {
      const a = attrs(m[1]),
        href = publicLink(a.href, url),
        label = plain(m[2], 120);
      if (!href) continue;
      if (
        /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(href) &&
        /^(?:github|(?:view|browse|view on|fork on|star on) github|(?:source|source code|repository)(?: on github)?|github repository)(?:\s*[↗→★])?$/i.test(
          label,
        )
      )
        addLink(href, 'repository');
      else if (href.endsWith('agentic.json')) addLink(href, 'profile');
      else if (/readme\.md$/i.test(href)) addLink(href, 'readme');
      else if (
        /\b(?:documentation|docs|api reference)\b/i.test(label) ||
        /\/(?:docs|documentation|openapi\.json)(?:\/|$)/i.test(
          new URL(href).pathname,
        )
      )
        addLink(href, 'documentation');
    }
  } else if (
    /text\/plain|text\/markdown|application\/octet-stream/i.test(contentType) ||
    /\.(?:md|txt)$/i.test(new URL(url).pathname)
  ) {
    const readable = input.replace(/<!--[^]*?-->/g, '');
    const heading = readable.match(/^#\s+(.+)$/m)?.[1];
    if (heading)
      suggestions.name = plain(
        heading.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'),
        100,
      );
    const stripped = readable
      .replace(/```[^]*?```/g, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
    const paragraphs = stripped
      .replace(/^>\s?/gm, '')
      .split(/\n\s*\n/)
      .map((x) => x.trim())
      .filter((x) => x && !/^[#>|*-]/.test(x))
      .map((x) => plain(x, 1500))
      .filter((x) => x.length >= 40)
      .slice(0, 4);
    suggestions.summary = paragraphs[0]?.slice(0, 240);
    suggestions.description = paragraphs.join('\n\n').slice(0, 6000);
    const setup = readable.match(
      /^#{1,3}\s+(?:Installation|Getting started|Quick start|Quickstart|Setup)[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|$(?![\s\S]))/im,
    )?.[1];
    if (setup)
      suggestions.setup = setup
        .trim()
        .slice(0, 6000)
        .replace(
          // eslint-disable-next-line no-control-regex -- Remove non-printing controls from imported setup text.
          /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
          '',
        );
    const features = readable.match(
      /^#{1,3}\s+(?:Features|Capabilities|Available tools|Tools)[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|$(?![\s\S]))/im,
    )?.[1];
    if (features)
      suggestions.capabilities = [...features.matchAll(/^\s*[-*]\s+(.+)$/gm)]
        .slice(0, 20)
        .map((x) => plain(x[1].replace(/[*`]/g, ''), 100))
        .filter((x) => x.length >= 2);
    for (const m of [
      ...readable.matchAll(/\[([^\]]{1,120})\]\(([^\s)]{1,2048})\)/g),
    ].slice(0, 100)) {
      const href = publicLink(m[2], url);
      if (!href) continue;
      if (
        /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(href) &&
        /^(?:github|source|source code|repository|github repository)$/i.test(
          m[1],
        )
      )
        addLink(href, 'repository');
      else if (href.endsWith('agentic.json')) addLink(href, 'profile');
      else if (/docs|documentation|reference/i.test(m[1]))
        addLink(href, 'documentation');
    }
    if (/readme\.md$/i.test(new URL(url).pathname)) suggestions.readmeUrl = url;
  }
  for (const key of Object.keys(suggestions) as ImportField[])
    if (
      !suggestions[key] ||
      (Array.isArray(suggestions[key]) &&
        !(suggestions[key] as unknown[]).length)
    )
      delete suggestions[key];
  for (const link of links) {
    const field =
      link.type === 'readme'
        ? 'readmeUrl'
        : link.type === 'profile'
          ? 'profileUrl'
          : link.type;
    if (!suggestions[field]) suggestions[field] = link.url;
  }
  return { suggestions, links: links.slice(0, 12) };
}

/** Never erase fields or replace an intentional edit, including an empty edit. */
export function mergeSuggestions(
  current: ListingInput,
  suggestions: Partial<ListingInput>,
  touched: readonly ImportField[],
) {
  const listing = { ...current },
    applied: ImportField[] = [],
    preserved: ImportField[] = [];
  for (const key of Object.keys(suggestions) as ImportField[]) {
    if (!(key in current) || key === 'kind') continue;
    const value = suggestions[key];
    if (
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && !value.length)
    )
      continue;
    if (JSON.stringify(value) === JSON.stringify(current[key])) continue;
    if (touched.includes(key)) {
      preserved.push(key);
      continue;
    }
    Object.assign(listing, { [key]: value });
    applied.push(key);
  }
  return { listing, applied, preserved };
}

export function suggestedCategory(
  text: string,
): ListingInput['category'] | undefined {
  const match = categories.find((c) =>
    text.toLowerCase().includes(c.toLowerCase()),
  );
  return match;
}
