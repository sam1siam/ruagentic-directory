import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { catalog } from '@/lib/server/catalog';
import { categories, kinds } from '@/lib/categories';
import { homeMarkdown, markdownResponse } from '@/lib/agent-responses';

export const revalidate = 3600;

/** GET /index.md — the homepage for Markdown readers. A request for / with
 *  Accept: text/markdown is rewritten here (next.config.ts). */
export async function GET() {
  const [overview, items] = await Promise.all([
    readFile(join(process.cwd(), 'public', 'llms.txt'), 'utf8'),
    catalog(),
  ]);
  const text = homeMarkdown(
    overview,
    kinds.map((k) => ({
      name: k.name,
      slug: k.slug,
      description: k.description,
      count: items.filter((i) => i.kind === k.kind).length,
    })),
    categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      description: c.description,
      count: items.filter((i) => i.category === c.name).length,
    })),
  );
  return markdownResponse(text, 200, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    Link: '<https://ruagentic.com/>; rel="canonical"',
  });
}
