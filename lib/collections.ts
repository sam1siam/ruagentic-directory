/** Curated entry points into the directory, shared by the collections page and the command palette. */
export const collections = [
  {
    name: 'Build with AI',
    category: 'Developer tools',
    description:
      'Development tools, code search, and connections for your coding agent.',
  },
  {
    name: 'Connect your data',
    category: 'Data & intelligence',
    description:
      'Bring databases and business information into your agent workflows.',
  },
  {
    name: 'Research and discover',
    category: 'Search & research',
    description:
      'Search tools and information sources for better informed agents.',
  },
  {
    name: 'Automate the work',
    category: 'Automation',
    description:
      'Build multi-step workflows and connect your everyday systems.',
  },
  {
    name: 'Choose your client',
    kind: 'client',
    description:
      'Find a home for MCP connections on your desktop, editor, or terminal.',
  },
  {
    name: 'Run your infrastructure',
    category: 'Infrastructure',
    description: 'Connect cloud services, deployments, and operational tools.',
  },
] as const;
export type Collection = (typeof collections)[number];
export function collectionHref(c: Collection) {
  return (
    '/?' +
    ('kind' in c
      ? 'kind=' + c.kind
      : 'category=' + encodeURIComponent(c.category))
  );
}
export function inCollection(
  c: Collection,
  item: { kind: string; category: string },
) {
  return 'kind' in c ? item.kind === c.kind : item.category === c.category;
}
