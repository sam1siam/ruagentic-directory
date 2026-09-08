import Link from 'next/link';
export const metadata = { title: 'Contact and support' };
export default function Page() {
  return (
    <main className="content-page">
      <div className="page-heading">
        <span className="eyebrow">WE CAN HELP</span>
        <h1>Contact RUAGENTIC.</h1>
        <p>
          Get help with your listing, report a correction, or ask about the
          Agentic project.
        </p>
      </div>
      <div className="contact-grid">
        <div>
          <h2>Listing support</h2>
          <p>
            For account, billing, or publication questions, include the listing
            URL and a short description. Do not send passwords or secret keys.
          </p>
          {process.env.SUPPORT_EMAIL ? (
            <a href={'mailto:' + process.env.SUPPORT_EMAIL}>
              {process.env.SUPPORT_EMAIL}
            </a>
          ) : (
            <a href="https://github.com/sam1siam/ruagentic-directory/issues/new">
              Open a support issue ↗
            </a>
          )}
        </div>
        <div>
          <h2>Correct a listing</h2>
          <p>
            Use Report on the listing page. Include the correct public source so
            the change can be checked.
          </p>
          <Link href="/">Find the listing ↗</Link>
        </div>
        <div>
          <h2>Agentic files</h2>
          <p>
            Generate your project files and use the auditor’s report to fix
            publication issues.
          </p>
          <a href="https://ruagentic.org/audit/">Open the Agentic auditor ↗</a>
        </div>
        <div>
          <h2>Directory development</h2>
          <p>
            Report a bug or propose an improvement through the separate
            directory repository.
          </p>
          <a href="https://github.com/sam1siam/ruagentic-directory">
            View the repository ↗
          </a>
        </div>
      </div>
    </main>
  );
}
