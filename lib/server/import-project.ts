import { cleanUrl, type ListingInput } from '../listing.ts';
import {
  extractDocument,
  plain,
  publicLink,
  suggestedCategory,
  type ImportField,
  type ImportResult,
} from '../project-import.ts';
import { readPublic } from './public-reader.ts';
type Read = typeof readPublic;
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
/** Six pinned, credential-free GETs at most, 992 KiB total, two in flight, 24s deadline. */
export async function importProject(
  value: string,
  kind: ListingInput['kind'],
  sourceType: 'homepage' | 'repository' | 'endpoint',
  read: Read = readPublic,
): Promise<ImportResult> {
  const start = new URL(cleanUrl(value));
  const result: ImportResult = {
    suggestions: {},
    evidence: [],
    observations: [],
    missing: [],
    notice: '',
  };
  const deadline = Date.now() + 24000,
    maxReads = 6,
    perRead = 98304;
  const visited = new Set<string>();
  const queue: { url: string; source: string; githubReadme?: boolean }[] = [];
  let count = 0;
  function suggest(values: Partial<ListingInput>, url: string, source: string) {
    for (const field of Object.keys(values) as ImportField[]) {
      const v = values[field];
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length))
        continue;
      if (
        field === 'kind' ||
        (result.suggestions[field] && field !== 'description')
      )
        continue;
      if (
        field === 'description' &&
        result.suggestions.description &&
        (result.suggestions.description.length >= String(v).length ||
          (result.suggestions.description.length >= 60 &&
            !(repo && source === 'Repository README')))
      )
        continue;
      Object.assign(result.suggestions, { [field]: v });
      result.evidence = result.evidence.filter((e) => e.field !== field);
      result.evidence.push({ field, url, source });
    }
  }
  function enqueue(url: string, source: string, githubReadme = false) {
    if (
      url &&
      !visited.has(url) &&
      !queue.some((x) => x.url === url) &&
      queue.length < 12
    )
      queue.push({ url, source, githubReadme });
  }
  function githubPath(url: string) {
    const u = new URL(url),
      parts = u.pathname.split('/').filter(Boolean);
    return u.hostname === 'github.com' &&
      parts.length === 2 &&
      parts.every((p) => /^[\w.-]+$/.test(p))
      ? parts.join('/')
      : '';
  }
  async function fetchDocument(item: (typeof queue)[number]) {
    if (visited.has(item.url) || count >= maxReads || Date.now() >= deadline)
      return;
    visited.add(item.url);
    count++;
    const byteLimit = count === 1 ? 524288 : perRead;
    try {
      const response = await read(item.url, byteLimit, deadline);
      if (Buffer.byteLength(response.text, 'utf8') > byteLimit)
        throw new Error('This document is too large for automatic import.');
      if (response.status < 200 || response.status >= 300)
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'This source needs authentication. Use public documentation or enter its details manually.'
            : 'Not publicly available (HTTP ' + response.status + ').',
        );
      let text = response.text,
        type = response.contentType,
        evidenceUrl = item.url;
      if (item.githubReadme) {
        const data = asRecord(JSON.parse(text));
        if (data.encoding !== 'base64' || typeof data.content !== 'string')
          throw new Error('The README could not be read.');
        text = Buffer.from(data.content, 'base64').toString('utf8');
        type = 'text/markdown';
        evidenceUrl = publicLink(data.download_url, item.url) || item.url;
        if (evidenceUrl.includes('raw.githubusercontent.com/'))
          suggest({ readmeUrl: evidenceUrl }, evidenceUrl, 'Repository README');
      }
      if (
        !/text\/(?:html|plain|markdown)|application\/(?:json|ld\+json|octet-stream)/i.test(
          type,
        )
      )
        throw new Error(
          'This URL does not serve readable HTML, JSON, or text. Use a public documentation page.',
        );
      const parsed = extractDocument(text, type, evidenceUrl);
      const projectOrigin = new URL(result.suggestions.homepage || start.origin)
        .origin;
      if (
        parsed.suggestions.profileUrl &&
        new URL(parsed.suggestions.profileUrl).origin !== projectOrigin
      ) {
        delete parsed.suggestions.profileUrl;
        delete parsed.suggestions.capabilities;
      }
      suggest(parsed.suggestions, evidenceUrl, item.source);
      if (
        sourceType === 'endpoint' &&
        item.url === start.origin + '/' &&
        !result.suggestions.homepage
      )
        suggest({ homepage: item.url }, item.url, 'Project homepage');
      for (const link of parsed.links) {
        if (
          link.type === 'profile' &&
          new URL(link.url).origin !== projectOrigin
        )
          continue;
        if (link.type === 'repository') {
          const repo = githubPath(link.url);
          if (repo)
            enqueue(
              'https://api.github.com/repos/' + repo + '/readme',
              'Repository README',
              true,
            );
        } else
          enqueue(
            link.url,
            link.type === 'documentation'
              ? 'Linked documentation'
              : 'Project file',
          );
      }
      result.observations.push({
        url: evidenceUrl,
        status: 'read',
        detail: 'Read public ' + item.source.toLowerCase() + '.',
      });
    } catch (e) {
      result.observations.push({
        url: item.url,
        status: 'unavailable',
        detail: plain((e as Error).message, 240),
      });
    }
  }
  const repo = githubPath(start.href);
  if (start.hostname === 'github.com' && !repo)
    throw new Error(
      'Use the repository root, such as https://github.com/owner/project.',
    );
  if (repo) {
    const api = 'https://api.github.com/repos/' + repo;
    suggest(
      { repository: start.href, homepage: start.href },
      start.href,
      'Submitted repository URL',
    );
    visited.add(api);
    count++;
    try {
      const response = await read(api, perRead, deadline);
      if (
        response.status !== 200 ||
        Buffer.byteLength(response.text, 'utf8') > perRead
      )
        throw new Error('Repository metadata could not be read.');
      const data = asRecord(JSON.parse(response.text));
      if (data.private) throw new Error('Use a public repository.');
      const homepage = publicLink(data.homepage, start.href);
      if (homepage) {
        result.suggestions.homepage = homepage;
        result.evidence = result.evidence.filter((e) => e.field !== 'homepage');
        result.evidence.push({
          field: 'homepage',
          url: api,
          source: 'GitHub repository',
        });
      }
      const license = plain(asRecord(data.license).spdx_id, 80);
      suggest(
        {
          name: plain(data.name, 100),
          summary: plain(data.description, 240),
          description: plain(data.description),
          tags: Array.isArray(data.topics)
            ? data.topics
                .filter((x): x is string => typeof x === 'string')
                .map((x) => plain(x, 30))
                .filter(Boolean)
                .slice(0, 8)
            : [],
          license: license === 'NOASSERTION' ? '' : license,
        },
        api,
        'GitHub repository',
      );
      result.observations.push({
        url: api,
        status: 'read',
        detail: 'Read public repository metadata.',
      });
      enqueue(api + '/readme', 'Repository README', true);
      const branch =
        typeof data.default_branch === 'string' ? data.default_branch : '';
      if (branch && /^[\w./-]+$/.test(branch))
        enqueue(
          'https://raw.githubusercontent.com/' +
            repo +
            '/' +
            branch +
            '/server.json',
          'MCP server manifest',
        );
      if (homepage && new URL(homepage).hostname !== 'github.com') {
        enqueue(homepage, 'Homepage');
        enqueue(new URL('/llms.txt', homepage).href, 'Documentation index');
        enqueue(new URL('/agentic.json', homepage).href, 'Agentic profile');
      }
    } catch (e) {
      result.observations.push({
        url: api,
        status: 'unavailable',
        detail: plain((e as Error).message, 240),
      });
      enqueue(api + '/readme', 'Repository README', true);
    }
  } else {
    suggest(
      sourceType === 'endpoint'
        ? { endpoint: start.href }
        : { homepage: start.href },
      start.href,
      'Submitted URL',
    );
    if (sourceType !== 'endpoint')
      await fetchDocument({
        url: start.href,
        source: 'Homepage or documentation',
      });
    else {
      // A read-only GET may expose endpoint docs; never initialize or invoke remote tools.
      await fetchDocument({
        url: start.href,
        source: 'Endpoint documentation',
      });
      enqueue(start.origin + '/', 'Project homepage');
    }
    enqueue(start.origin + '/llms.txt', 'Documentation index');
    enqueue(start.origin + '/agentic.json', 'Agentic profile');
    enqueue(start.origin + '/README.md', 'Project README');
    enqueue(start.origin + '/openapi.json', 'OpenAPI document');
  }
  while (queue.length && count < maxReads && Date.now() < deadline) {
    const batch = queue.splice(0, Math.min(2, maxReads - count));
    await Promise.allSettled(batch.map(fetchDocument));
  }
  const category = suggestedCategory((result.suggestions.tags ?? []).join(' '));
  if (category)
    suggest(
      { category },
      result.evidence.find((e) => e.field === 'tags')?.url || start.href,
      'Published tags',
    );
  for (const [field, label, min] of [
    ['name', 'project name', 2],
    ['summary', 'short description', 20],
    ['description', 'project description', 60],
    ['homepage', 'homepage', 1],
  ] as const)
    if ((result.suggestions[field] ?? '').length < min)
      result.missing.push(label);
  if (
    kind === 'server' &&
    !result.suggestions.endpoint &&
    !result.suggestions.repository
  )
    result.missing.push('repository or MCP endpoint');
  if (!result.suggestions.setup) result.missing.push('setup instructions');
  if (!result.suggestions.authentication)
    result.missing.push('authentication details');
  const fields = Object.keys(result.suggestions).length;
  result.notice =
    fields +
    ' field suggestion' +
    (fields === 1 ? '' : 's') +
    ' found. ' +
    (result.missing.length
      ? 'Review them and add ' + result.missing.join(', ') + '.'
      : 'Review the imported details before continuing.');
  return result;
}
