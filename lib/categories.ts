/** Directory taxonomy shared by pages, the sidebar filters and the command palette. */
export const categories = [
  {
    slug: 'developer-tools',
    name: 'Developer tools',
    description:
      'Coding agents, IDE integrations, repositories, CI and the tooling that surrounds them.',
  },
  {
    slug: 'data-intelligence',
    name: 'Data & intelligence',
    description:
      'Databases, vector stores, analytics and machine learning platforms agents can query.',
  },
  {
    slug: 'productivity',
    name: 'Productivity',
    description:
      'Tasks, documents, chat clients and workspace tools that keep work moving.',
  },
  {
    slug: 'search-research',
    name: 'Search & research',
    description:
      'Web search, retrieval and information sources for better informed agents.',
  },
  {
    slug: 'communication',
    name: 'Communication',
    description: 'Email, messaging and customer conversation channels.',
  },
  {
    slug: 'design-content',
    name: 'Design & content',
    description:
      'Design tools, content systems, media and generation for creative work.',
  },
  {
    slug: 'infrastructure',
    name: 'Infrastructure',
    description:
      'Cloud platforms, deployment, secrets and operational control.',
  },
  {
    slug: 'finance',
    name: 'Finance',
    description: 'Payments, market data and financial operations.',
  },
  {
    slug: 'automation',
    name: 'Automation',
    description:
      'Workflow platforms, browser automation and integrations that connect everyday systems.',
  },
] as const;
export type Category = (typeof categories)[number];
export const kinds = [
  {
    slug: 'servers',
    kind: 'server',
    name: 'MCP servers',
    singular: 'MCP server',
    description:
      'Servers that expose tools, resources and prompts to any MCP client.',
  },
  {
    slug: 'clients',
    kind: 'client',
    name: 'Clients',
    singular: 'MCP client',
    description:
      'Editors, terminals, desktop apps and assistants that connect to MCP servers.',
  },
  {
    slug: 'products',
    kind: 'product',
    name: 'Agentic products',
    singular: 'Agentic product',
    description: 'Agents, frameworks and platforms built for autonomous work.',
  },
] as const;
export type KindPage = (typeof kinds)[number];
/** Editorial picks shown first on the home page. Everything else follows alphabetically. */
export const featured: Record<KindPage['kind'], string[]> = {
  server: [
    'github-mcp',
    'playwright-mcp',
    'context7',
    'supabase-mcp',
    'stripe-mcp',
    'notion-mcp',
    'aws-mcp-servers',
    'cloudflare-mcp',
  ],
  client: [
    'claude-code',
    'cursor',
    'visual-studio-code',
    'windsurf',
    'zed',
    'cline',
    'gemini-cli',
    'codex-cli',
  ],
  product: [
    'n8n',
    'mastra',
    'langgraph',
    'crewai',
    'dify',
    'composio',
    'openhands',
    'openai-agents-sdk',
  ],
};
export const categoryBySlug = (slug: string) =>
  categories.find((c) => c.slug === slug);
export const categoryByName = (name: string) =>
  categories.find((c) => c.name === name);
export const kindBySlug = (slug: string) => kinds.find((k) => k.slug === slug);
export const kindByValue = (kind: string) => kinds.find((k) => k.kind === kind);
export const categoryHref = (c: Pick<Category, 'slug'>) =>
  '/categories/' + c.slug;
