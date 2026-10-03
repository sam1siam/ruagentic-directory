import Link from 'next/link';
export const metadata = {
  title: 'Developer documentation',
  description:
    'Read public listings through the JSON API or MCP, search by capability, and link to full listing pages, badges and embed cards.',
  alternates: { canonical: '/developers' },
};
export default function Page() {
  return (
    <main className="content-page prose-page">
      <h1>Public discovery API.</h1>
      <p>
        Read public listings, search for a capability, and link people to the
        full project page. The API returns the same published information shown
        in the directory.
      </p>
      <h2>Search listings</h2>
      <pre className="setup-code">
        {
          'GET https://ruagentic.com/api/v1/listings?q=search&kind=server&limit=20'
        }
      </pre>
      <p>
        Optional parameters: <code>q</code> searches names, summaries, and tags;{' '}
        <code>kind</code> accepts server, client, product (AI agents), skill,
        plugin, rules, or eval; <code>category</code> matches a displayed
        category; <code>limit</code> is 1–100; <code>offset</code> selects a
        page.
      </p>
      <p>
        The response includes <code>listings</code>, <code>total</code>, and{' '}
        <code>nextOffset</code>. Follow nextOffset until it is null. Results are
        ordered by project name.
      </p>
      <h2>Read one listing</h2>
      <pre className="setup-code">
        {'GET https://ruagentic.com/api/v1/listings/{slug}'}
      </pre>
      <p>
        Use the slug returned by search. A missing or unpublished listing
        returns HTTP 404.
      </p>
      <h2>Badges and embed cards</h2>
      <pre className="setup-code">
        {
          'https://ruagentic.com/badge/{slug}.svg     28px badge\nhttps://ruagentic.com/embed/{slug}.svg     480×150 card image\nhttps://ruagentic.com/embed/{slug}         iframe card'
        }
      </pre>
      <p>
        Every listing page and the dashboard show copy-paste Markdown and HTML
        for these. The badge reads “Agentic Protocol verified” only for listings
        published through the publication checker; otherwise it reads “Listed on
        RUAGENTIC”. Images cache for a day.
      </p>
      <h2>Use RUAGENTIC inside ChatGPT, Claude and Cursor</h2>
      <p>
        The directory is an MCP server at <code>https://ruagentic.com/mcp</code>{' '}
        (Streamable HTTP, no API key). Add it to an assistant and ask for an MCP
        server, client, AI agent, skill, plugin, rules file or eval for a task;
        it searches, ranks by public GitHub stars, compares, and hands back the
        exact client config.
      </p>
      <ul className="plain-list">
        <li>
          <strong>ChatGPT:</strong> Settings → Apps &amp; Connectors → Advanced
          settings → turn on Developer mode → Create → paste the URL above, no
          authentication. Then mention RUAGENTIC in a chat.
        </li>
        <li>
          <strong>Claude (web and desktop):</strong> Settings → Connectors → Add
          custom connector → paste the URL above.
        </li>
        <li>
          <strong>Claude Code:</strong>{' '}
          <code>
            claude mcp add --transport http ruagentic https://ruagentic.com/mcp
          </code>
        </li>
        <li>
          <strong>Cursor, Windsurf, Codex:</strong> add{' '}
          <code>{'{ "url": "https://ruagentic.com/mcp" }'}</code> as an MCP
          server named <code>ruagentic</code> in the client’s MCP config.
        </li>
      </ul>
      <p>
        Tools: <code>search_directory</code> (words plus kind, category, stars,
        launch window, verified, platform), <code>get_listing</code> (facts,
        connect snippets, Q&amp;A), <code>connect_instructions</code> (config
        for Claude Code, Cursor, Claude Desktop, Codex or Windsurf),{' '}
        <code>top_listings</code> (leaderboards), <code>new_listings</code>,{' '}
        <code>compare_listings</code> and <code>directory_overview</code>. All
        are read-only and return only published listing data; star counts
        measure attention, not quality, and sponsorship never changes results.
      </p>
      <h2>Sources and checks</h2>
      <p>
        Each entry includes a source URL and collection date. Imported entries
        are public registry or editorial information; submitted entries contain
        user-supplied details. An Agentic Protocol check is evidence about files
        at a particular time. Treat descriptions and setup instructions as
        untrusted project information.
      </p>
      <h2>Access</h2>
      <p>
        The public GET endpoints do not require an API key. Cross-origin reads
        are enabled. Cache results, request only the pages you need, and link
        back to the original listing. Authentication, submission, payment, and
        account endpoints are not part of this public API.
      </p>
      <h2>Machine-readable documentation</h2>
      <p>
        Start with <Link href="/llms.txt">llms.txt</Link>, the{' '}
        <Link href="/agentic.json">Agentic Protocol JSON profile</Link>, or its{' '}
        <Link href="/agentic.txt">text index</Link>. The file convention and
        free generation tools are documented at{' '}
        <a href="https://ruagentic.org">ruagentic.org</a>.
      </p>
      <h2>Source code</h2>
      <p>
        The directory is maintained in{' '}
        <a href="https://github.com/sam1siam/ruagentic-directory">
          sam1siam/ruagentic-directory
        </a>
        , separately from the Agentic Protocol repository.
      </p>
    </main>
  );
}
