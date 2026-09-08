export const metadata = { title: 'Listing guidelines' };
export default function Page() {
  return (
    <main className="content-page prose-page">
      <h1>Listing guidelines.</h1>
      <p>
        We welcome MCP servers, MCP clients, and products built for AI agents.
        Help people understand what your project offers and how to get started.
      </p>
      <ol>
        <li>
          <strong>Use the project’s real name.</strong> Write a clear summary
          and describe practical use cases. Keep claims factual.
        </li>
        <li>
          <strong>Choose the right type.</strong> Identify a server, client, or
          agentic product. If a product offers several servers, explain that
          relationship.
        </li>
        <li>
          <strong>Provide public sources.</strong> Add a homepage, repository,
          documentation, and the public connection endpoint when available.
        </li>
        <li>
          <strong>Describe access accurately.</strong> Include supported
          transport, authentication, pricing, and setup requirements. Leave
          unknown details unspecified.
        </li>
        <li>
          <strong>Keep credentials private.</strong> Never submit API keys,
          passwords, private tokens, or credential-bearing URLs. Use
          placeholders in configuration instructions.
        </li>
        <li>
          <strong>Respect project ownership.</strong> Submit projects you
          maintain or have permission to represent. Use the report option on an
          existing listing to request corrections.
        </li>
        <li>
          <strong>Keep information current.</strong> Update your listing when
          endpoints, pricing, or supported capabilities change.
        </li>
        <li>
          <strong>Avoid misleading or harmful listings.</strong> Impersonation,
          deceptive claims, credential harvesting, malware, and unlawful
          services may be removed.
        </li>
      </ol>
      <h2>Free publication</h2>
      <p>
        The Agentic files must describe the project being submitted. A passing
        report for another website does not qualify. Publish matching JSON, TXT,
        and README links, then run the checker in the submission form.
      </p>
      <h2>What labels mean</h2>
      <p>
        “Registry import” identifies public registry information. “Editorial
        entry” identifies information collected from project sources. “User
        submission” identifies information supplied through a RUAGENTIC account.
      </p>
      <p>
        An Agentic check reports public file consistency at the displayed time.
        It does not certify ownership, security, compatibility, uptime, or the
        behavior of a service. Payment grants listing eligibility and is
        separate from technical checks.
      </p>
      <h2>Corrections and removal</h2>
      <p>
        Use Report on a listing to identify inaccurate information or request an
        ownership-related correction. Signed-in users can unpublish their own
        listings from the dashboard.
      </p>
    </main>
  );
}
