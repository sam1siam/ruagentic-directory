/** Responses for agents: RFC 9457 problem details from the public API and
 *  Markdown bodies for clients that send Accept: text/markdown. Pure, so
 *  the route handlers stay thin and the formats are testable. */

const site = 'https://ruagentic.com';

/** Every error the public API returns. The type URI points at the matching
 *  entry under "Errors" on the developer page. */
export const problemTypes = {
  listing_not_found: {
    status: 404,
    title: 'Listing not found',
    hint: 'Search with GET /api/v1/listings?q=<words> and use a slug from the results.',
  },
  endpoint_not_found: {
    status: 404,
    title: 'Endpoint not found',
    hint: 'The public endpoints are described in https://ruagentic.com/openapi.json.',
  },
  directory_unavailable: {
    status: 503,
    title: 'Directory temporarily unavailable',
    hint: 'The listing data could not be read. Retry the same request with backoff.',
  },
} as const;
export type ProblemCode = keyof typeof problemTypes;

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: ProblemCode;
  hint: string;
  docs: string;
  /** The message older clients read before problem details existed. */
  error: string;
};

export function problem(code: ProblemCode, detail: string): Problem {
  const t = problemTypes[code];
  return {
    type: `${site}/developers#error-${code.replaceAll('_', '-')}`,
    title: t.title,
    status: t.status,
    detail,
    code,
    hint: t.hint,
    docs: site + '/developers',
    error: detail,
  };
}

export function problemResponse(code: ProblemCode, detail: string) {
  const body = problem(code, detail);
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: {
      'Content-Type': 'application/problem+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

export function markdownResponse(
  text: string,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      ...headers,
    },
  });
}

/** The 404 body for Markdown readers. The requested path is not echoed, so
 *  a crafted URL cannot put its own text in front of an agent. */
export function notFoundMarkdown() {
  return [
    '# Page not found (404)',
    '',
    'There is no page at this address on RUAGENTIC. The listing may have moved or been removed.',
    '',
    `- [Directory](${site}/): search MCP servers, clients, AI agents, skills, plugins, rules files and evals.`,
    `- [llms.txt](${site}/llms.txt): the agent-readable index of this site.`,
    `- [Sitemap](${site}/sitemap.xml): every public page.`,
    `- [Developer documentation](${site}/developers): the public API, MCP server and CLI.`,
    '',
  ].join('\n');
}

type Count = { name: string; slug: string; description: string; count: number };

/** The homepage as Markdown: the llms.txt overview with the current number
 *  of listings of each kind and in each category inserted before its first
 *  section. Counts come from the catalog, never from fixed numbers. */
export function homeMarkdown(
  overview: string,
  kinds: Count[],
  categories: Count[],
) {
  const text = overview.trim();
  const split = text.indexOf('\n## ');
  const head = (split === -1 ? text : text.slice(0, split)).trimEnd();
  const rest = split === -1 ? '' : text.slice(split + 1);
  const total = kinds.reduce((sum, k) => sum + k.count, 0);
  const lines = [
    head,
    '',
    '## In the directory now',
    `${total} public listings.`,
    '',
    ...kinds.map(
      (k) => `- [${k.name}](${site}/${k.slug}): ${k.count}. ${k.description}`,
    ),
    '',
    '## Categories',
    ...categories.map(
      (c) =>
        `- [${c.name}](${site}/categories/${c.slug}): ${c.count} listings. ${c.description}`,
    ),
  ];
  if (rest) lines.push('', rest);
  return lines.join('\n') + '\n';
}
