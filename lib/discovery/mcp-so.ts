import { parse } from 'acorn';
import { load } from 'cheerio';
import { object } from './contracts.ts';

// Read public server-rendered metadata as syntax only. Never execute page scripts.
const unwrap = (value: unknown) => {
  let node = object(value);
  for (
    let i = 0;
    i < 8 && node.type === 'AssignmentExpression' && node.operator === '=';
    i++
  )
    node = object(node.right);
  return node;
};
const key = (value: unknown) => {
  const node = object(value);
  return node.type === 'Identifier'
    ? node.name
    : node.type === 'Literal'
      ? node.value
      : undefined;
};
const field = (value: unknown, name: string) => {
  const node = unwrap(value);
  if (node.type !== 'ObjectExpression' || !Array.isArray(node.properties))
    return {};
  const property = node.properties
    .map(object)
    .find(
      (p) =>
        p.type === 'Property' &&
        p.kind === 'init' &&
        !p.computed &&
        key(p.key) === name,
    );
  return unwrap(property?.value);
};
const string = (node: Record<string, unknown>) =>
  node.type === 'Literal' && typeof node.value === 'string'
    ? node.value
    : undefined;

/** Bind createdAt to this exact server, excluding recommendations, update dates and badge text. */
export function mcpSoMetadata(
  html: string,
  slug: string,
): { name?: string; publishedAt: string } | undefined {
  const $ = load(html);
  const matches: { name?: string; publishedAt: string }[] = [];
  for (const element of $('script').toArray()) {
    const script = $(element).text();
    if (!script.includes('createdAt') || !script.includes(slug)) continue;
    try {
      const stack: unknown[] = [
        parse(script, { ecmaVersion: 'latest', sourceType: 'module' }),
      ];
      let visited = 0;
      while (stack.length) {
        if (++visited > 100000) return;
        const value = stack.pop();
        if (Array.isArray(value)) {
          stack.push(...value);
          continue;
        }
        const node = object(value);
        if (
          node.type === 'Property' &&
          node.kind === 'init' &&
          !node.computed &&
          key(node.key) === 'server'
        ) {
          const server = unwrap(node.value);
          if (
            string(field(server, 'slug')) === slug ||
            string(field(server, 'previousSlug')) === slug
          ) {
            const created = field(server, 'createdAt');
            const publishedAt =
              string(created) ||
              (created.type === 'NewExpression' &&
              key(created.callee) === 'Date' &&
              Array.isArray(created.arguments) &&
              created.arguments.length === 1
                ? string(unwrap(created.arguments[0]))
                : undefined);
            if (publishedAt && Number.isFinite(Date.parse(publishedAt)))
              matches.push({
                name: string(field(server, 'name')),
                publishedAt: new Date(publishedAt).toISOString(),
              });
          }
        }
        for (const child of Object.values(node))
          if (child && typeof child === 'object') stack.push(child);
      }
    } catch {
      /* A changed serialization format requires review, not a guessed date. */
    }
  }
  if (matches.length && new Set(matches.map((m) => m.publishedAt)).size === 1)
    return matches[0];
}
