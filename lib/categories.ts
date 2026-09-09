/** Directory taxonomy shared by pages, the sidebar filters, the command
 *  palette, the advertise form and the listing schema. Slugs are URLs, so
 *  existing ones never change. */
export const categories = [
  {
    slug: 'developer-tools',
    name: 'Developer tools',
    description:
      'Coding agents, IDE integrations, repositories, CI and the tooling that surrounds them.',
  },
  {
    slug: 'ai-models',
    name: 'AI & language models',
    description:
      'Model gateways, inference, agent frameworks, memory, evaluation and observability for LLM applications.',
  },
  {
    slug: 'data-intelligence',
    name: 'Data & intelligence',
    description:
      'Databases, vector stores, analytics and data pipelines agents can query.',
  },
  {
    slug: 'search-research',
    name: 'Search & research',
    description:
      'Web search, retrieval, academic and knowledge sources for better informed agents.',
  },
  {
    slug: 'browser-automation',
    name: 'Browser & web automation',
    description: 'Browser control, scraping and agents that act on the web.',
  },
  {
    slug: 'automation',
    name: 'Automation',
    description:
      'Workflow platforms, integrations and RPA that connect everyday systems.',
  },
  {
    slug: 'productivity',
    name: 'Productivity',
    description:
      'Tasks, documents, notes and workspace tools that keep work moving.',
  },
  {
    slug: 'communication',
    name: 'Communication',
    description: 'Email, chat, messaging and social channels.',
  },
  {
    slug: 'support-sales',
    name: 'Customer support & sales',
    description:
      'Help desks, CRMs, sales pipelines and customer-facing agents.',
  },
  {
    slug: 'marketing',
    name: 'Marketing & SEO',
    description: 'Campaigns, web analytics, SEO and advertising tools.',
  },
  {
    slug: 'design-content',
    name: 'Design & content',
    description: 'Design tools, content systems and writing for creative work.',
  },
  {
    slug: 'media',
    name: 'Media, audio & video',
    description:
      'Image, speech, audio, music and video generation and processing.',
  },
  {
    slug: 'infrastructure',
    name: 'Infrastructure',
    description:
      'Cloud platforms, deployment, monitoring and operational control.',
  },
  {
    slug: 'security',
    name: 'Security & identity',
    description:
      'Authentication, secrets, scanning, compliance and threat intelligence.',
  },
  {
    slug: 'finance',
    name: 'Finance',
    description: 'Payments, banking, accounting, markets and crypto.',
  },
  {
    slug: 'ecommerce',
    name: 'E-commerce',
    description: 'Storefronts, catalogs, orders and fulfilment.',
  },
  {
    slug: 'science-health',
    name: 'Science & health',
    description: 'Biology, medicine, scientific data and health tools.',
  },
  {
    slug: 'gaming',
    name: 'Gaming & 3D',
    description: 'Game engines, 3D tools and virtual worlds.',
  },
  {
    slug: 'location-travel',
    name: 'Location & travel',
    description: 'Maps, geodata, weather, transport and travel.',
  },
  {
    slug: 'other',
    name: 'Other',
    description: 'Tools that do not fit another category yet.',
  },
] as const;
export type Category = (typeof categories)[number];
export const categoryNames = categories.map((c) => c.name);
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
/** Hand-picked leads for the home page sections, by kind. */
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
