export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { catalog } from '@/lib/server/catalog';
import { CornerBrackets } from '@/components/design-interactions';
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
      description:
        'Connect cloud services, deployments, and operational tools.',
    },
  ];
  return (
    <main className="content-page collections-page">
      <div className="page-heading collections-heading">
        <div>
          <h1>Start with a collection.</h1>
          <p>
            Useful ways into the ecosystem, organized around what you want to
            do.
          </p>
        </div>
        <dl className="collection-stats">
          <div>
            <dt>COLLECTIONS</dt>
            <dd>{collections.length}</dd>
          </div>
          <div>
            <dt>TOOLS INDEXED</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt>PROJECT TYPES</dt>
            <dd>{new Set(items.map((item) => item.kind)).size}</dd>
          </div>
        </dl>
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
            <span className="card-glow" aria-hidden="true" />
            <CornerBrackets />
            <div className="collection-top">
              <span>
                {
                  items.filter((p) =>
                    c.kind ? p.kind === c.kind : p.category === c.category,
                  ).length
                }{' '}
                TOOLS
              </span>
            </div>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <div className="collection-bottom">
              <div className="collection-members">
                {items
                  .filter((p) =>
                    c.kind ? p.kind === c.kind : p.category === c.category,
                  )
                  .slice(0, 3)
                  .map((p) => (
                    <i key={p.slug} title={p.name}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </i>
                  ))}
              </div>
              <span>
                OPEN <ArrowRight size={15} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
