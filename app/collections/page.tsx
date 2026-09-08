export const dynamic = 'force-dynamic';
import Link from 'next/link';
import {
  ArrowUpRight,
  Code2,
  Search,
  Workflow,
  Monitor,
  Database,
  Cloud,
} from 'lucide-react';
import { catalog } from '@/lib/server/catalog';
export const metadata = {
  title: 'Collections',
  description:
    'Explore MCP servers and agentic tools by workflow, from coding and research to data and automation.',
};
export default async function Page() {
  const items = await catalog();
  const collections = [
    {
      name: 'Build with AI',
      category: 'Developer tools',
      description:
        'Development tools, code search, and connections for your coding agent.',
      icon: Code2,
    },
    {
      name: 'Connect your data',
      category: 'Data & intelligence',
      description:
        'Bring databases and business information into your agent workflows.',
      icon: Database,
    },
    {
      name: 'Research and discover',
      category: 'Search & research',
      description:
        'Search tools and information sources for better informed agents.',
      icon: Search,
    },
    {
      name: 'Automate the work',
      category: 'Automation',
      description:
        'Build multi-step workflows and connect your everyday systems.',
      icon: Workflow,
    },
    {
      name: 'Choose your client',
      kind: 'client',
      description:
        'Find a home for MCP connections on your desktop, editor, or terminal.',
      icon: Monitor,
    },
    {
      name: 'Run your infrastructure',
      category: 'Infrastructure',
      description:
        'Connect cloud services, deployments, and operational tools.',
      icon: Cloud,
    },
  ];
  return (
    <main className="content-page">
      <div className="page-heading">
        <span className="eyebrow">FIND YOUR WORKFLOW</span>
        <h1>Start with a collection.</h1>
        <p>
          Useful ways into the ecosystem, organized around what you want to do.
        </p>
      </div>
      <div className="collection-grid">
        {collections.map((c) => (
          <Link
            className="collection-card"
            key={c.name}
            href={
              '/?' +
              (c.kind
                ? 'kind=' + c.kind
                : 'category=' + encodeURIComponent(c.category!))
            }
          >
            <c.icon size={27} />
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <div className="collection-members">
              {items
                .filter((p) =>
                  c.kind ? p.kind === c.kind : p.category === c.category,
                )
                .slice(0, 4)
                .map((p) => (
                  <i key={p.slug} title={p.name}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </i>
                ))}
            </div>
            <span>
              {
                items.filter((p) =>
                  c.kind ? p.kind === c.kind : p.category === c.category,
                ).length
              }{' '}
              tools
              <ArrowUpRight size={19} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
