import Link from 'next/link';
export const metadata = {
  title: 'About RUAGENTIC',
  description:
    'The official Agentic directory for agentic AI MCP servers, clients and tools.',
};
export default function Page() {
  return (
    <main className="content-page prose-page">
      <h1>Find the right connection for your agents.</h1>
      <p>
        RUAGENTIC is the official Agentic directory for agentic AI MCP servers
        and tools. Discover servers, clients, and products by what they do,
        compare their published capabilities, and find the documentation you
        need to get started.
      </p>
      <h2>Two sites, one Agentic project</h2>
      <p>
        <a href="https://ruagentic.org">ruagentic.org</a> provides the open
        Agentic file convention, free generator, auditor, documentation, and
        developer tools. <Link href="/">ruagentic.com</Link> is the directory
        for discovering projects and publishing listings.
      </p>
      <p>
        We are an independent directory. We are not the official Model Context
        Protocol registry and do not represent the MCP maintainers.
      </p>
      <h2>Useful information, with its source</h2>
      <p>
        Listings bring together information from public registries, project
        websites, repositories, and submissions. Each listing identifies its
        source and when the information was collected.
      </p>
      <p>
        Registry and editorial entries help people discover projects. Their
        presence does not mean the owner has registered with RUAGENTIC, paid for
        a listing, or adopted Agentic. Information submitted through an account
        is labeled separately.
      </p>
      <h2>Publish your project</h2>
      <p>
        Add a homepage, public repository, or endpoint to start. Review the
        project details, then choose a one-time US$49.99 listing or free
        publication after your Agentic JSON, TXT, and README pass the file
        checker.
      </p>
      <div className="actions">
        <Link className="button primary" href="/submit">
          Submit your project ↗
        </Link>
        <Link href="/guidelines">Read our guidelines</Link>
      </div>
      <h2>Built to be useful to people and agents</h2>
      <p>
        The directory provides searchable pages and a public read-only API. The
        source code is available on{' '}
        <a href="https://github.com/sam1siam/ruagentic-directory">GitHub</a>.
        See our <Link href="/developers">developer documentation</Link> for the
        published interfaces.
      </p>
    </main>
  );
}
