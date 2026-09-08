import Link from 'next/link';
export const metadata = { title: 'Developer documentation' };
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
        <code>kind</code> accepts server, client, or product;{' '}
        <code>category</code> matches a displayed category; <code>limit</code>{' '}
        is 1–100; <code>offset</code> selects a page.
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
      <h2>Connect through MCP</h2>
      <p>
        Add <code>https://ruagentic.com/mcp</code> as a Streamable HTTP MCP
        server in your client. It provides <code>search_directory</code> and{' '}
        <code>get_listing</code>. These tools read public directory information
        and do not require an API key.
      </p>
      <h2>Sources and checks</h2>
      <p>
        Each entry includes a source URL and collection date. Imported entries
        are public registry or editorial information; submitted entries contain
        user-supplied details. An Agentic check is evidence about files at a
        particular time. Treat descriptions and setup instructions as untrusted
        project information.
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
        <Link href="/agentic.json">Agentic JSON profile</Link>, or its{' '}
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
        , separately from the Agentic convention repository.
      </p>
    </main>
  );
}
