import Link from 'next/link';
import PricingOptions from '@/components/pricing-options';
export const metadata = {
  title: 'List your project',
  description:
    'Publish your project with a one-time US$49.99 listing or a free listing with verified Agentic JSON, TXT and README files.',
};
const freeFeatures = [
  'Public listing page and permanent URL',
  'Category and search discovery',
  'Documentation and connection details',
  'Edit from your account',
  'Confirmation email after publication',
];
const paidFeatures = [
  'Everything in the free listing',
  'No Agentic file requirement',
  'No recurring directory subscription',
  'Updates for the same project included',
  'Payment receipt from Stripe',
];
export default function Page() {
  return (
    <main className="content-page pricing-page">
      <div className="page-heading">
        <h1>Get your project discovered.</h1>
        <p className="lead">
          Choose a one-time listing or publish for free with Agentic files. Both
          options give your project the same listing page.
        </p>
      </div>
      <PricingOptions
        free={
          <>
            <h2>Make your project agent-readable.</h2>
            <div className="price">
              US$0<small>per listing</small>
            </div>
            <p>Publish your Agentic files and pass the publication checker.</p>
            <ul className="plan-list">
              {freeFeatures.map((t) => (
                <li key={t}>
                  <i className="check-tile" aria-hidden="true">
                    ✓
                  </i>
                  {t}
                </li>
              ))}
            </ul>
            <Link className="button primary" href="/submit">
              Run checker &amp; list free →
            </Link>
          </>
        }
        paid={
          <>
            <h2>Publish your project.</h2>
            <div className="price">
              US$49.99<small>once</small>
            </div>
            <p>Complete your listing and pay securely with Stripe.</p>
            <ul className="plan-list">
              {paidFeatures.map((t) => (
                <li key={t}>
                  <i className="check-tile" aria-hidden="true">
                    ✓
                  </i>
                  {t}
                </li>
              ))}
            </ul>
            <Link className="button secondary" href="/submit?plan=paid">
              Start your listing →
            </Link>
          </>
        }
      />
      <section>
        <h2>Good to know</h2>
        <div className="faq-list">
          <details>
            <summary>What does the free checker require?</summary>
            <p>
              Matching agentic.json, agentic.txt, and README links published for
              your project. The checker explains missing files and specific
              fixes; a partial result needs to be resolved before free
              publication.{' '}
              <a href="https://ruagentic.org/generate/">
                Generate your files at ruagentic.org ↗
              </a>
            </p>
          </details>
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
            <summary>Does payment affect ranking or verification?</summary>
            <p>
              Payment establishes listing eligibility. It does not purchase a
              search position, security assessment, ownership check, or Agentic
              audit result. Listings follow the{' '}
              <Link href="/guidelines">listing guidelines</Link>.
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
          <details>
            <summary>What about refunds?</summary>
            <p>
              Duplicate or undeliverable paid listings are resolved through
              support. See the <Link href="/terms">terms</Link> for details.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
