import Link from 'next/link';
import { Check, ArrowUpRight } from 'lucide-react';
export const metadata = {
  title: 'Listing options',
  description:
    'Publish your project with a one-time US$49.99 listing or a free listing with verified Agentic JSON, TXT and README files.',
};
export default function Page() {
  return (
    <main className="content-page">
      <div className="page-heading">
        <span className="eyebrow">ONE DIRECTORY. TWO WAYS IN.</span>
        <h1>Get your project discovered.</h1>
        <p>
          Choose a one-time listing or publish for free with Agentic files. Both
          options give your project the same useful listing page.
        </p>
      </div>
      <div className="pricing-grid">
        <section className="pricing-card">
          <span className="eyebrow">FREE WITH AGENTIC</span>
          <h2>Make your project agent-readable.</h2>
          <div className="price">
            US$0<small>per listing</small>
          </div>
          <p>Publish your Agentic files and pass the publication checker.</p>
          <ul>
            {[
              'Public listing page and permanent URL',
              'Category and search discovery',
              'Documentation and connection details',
              'Edit from your account',
              'Confirmation email after publication',
            ].map((t) => (
              <li key={t}>
                <Check size={17} />
                {t}
              </li>
            ))}
          </ul>
          <Link className="button primary" href="/submit">
            Check and list for free
            <ArrowUpRight size={16} />
          </Link>
          <p>
            Requires matching agentic.json, agentic.txt, and README links for
            your project.{' '}
            <a className="text-link" href="https://ruagentic.org/generate/">
              Generate your files ↗
            </a>
          </p>
        </section>
        <section className="pricing-card paid">
          <span className="eyebrow">ONE-TIME LISTING</span>
          <h2>Publish your project.</h2>
          <div className="price">
            US$49.99<small>once</small>
          </div>
          <p>Complete your listing and pay securely with Stripe.</p>
          <ul>
            {[
              'Everything in the free listing',
              'No Agentic file requirement',
              'No recurring directory subscription',
              'Updates for the same project included',
              'Payment receipt from Stripe',
            ].map((t) => (
              <li key={t}>
                <Check size={17} />
                {t}
              </li>
            ))}
          </ul>
          <Link className="button secondary" href="/submit?plan=paid">
            Start your listing
            <ArrowUpRight size={16} />
          </Link>
          <p>
            Payment covers directory publication. Listings follow our{' '}
            <Link className="text-link" href="/guidelines">
              guidelines
            </Link>
            .
          </p>
        </section>
      </div>
      <section>
        <h2>Good to know</h2>
        <div className="faq-list">
          <details>
            <summary>
              Does ruagentic.org charge for its generator or convention?
            </summary>
            <p>
              No. The convention, generator, and auditor at ruagentic.org remain
              free. The optional US$49.99 fee is for a directory listing on
              ruagentic.com.
            </p>
          </details>
          <details>
            <summary>What does the free checker require?</summary>
            <p>
              Your project’s JSON profile, matching TXT index, and public README
              links must all pass. The form explains missing files and specific
              fixes. A partial result needs to be resolved before free
              publication.
            </p>
          </details>
          <details>
            <summary>Does payment affect ranking or verification?</summary>
            <p>
              Payment establishes listing eligibility. It does not purchase a
              search position, security assessment, ownership check, or Agentic
              audit result.
            </p>
          </details>
          <details>
            <summary>Can I update my listing?</summary>
            <p>
              Yes. Edit it in your dashboard, review the updated details, and
              publish them. A paid listing covers updates to the same project.
              Free listings need a fresh file check when publishing an update.
            </p>
          </details>
          <details>
            <summary>Can my README stay on GitHub?</summary>
            <p>
              Yes. Provide its public raw Markdown URL during the file check.
              Your JSON and TXT files need to be published on your project
              website.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
