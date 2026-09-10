import Link from 'next/link';
export const metadata = {
  title: 'Terms of service',
  description:
    'The terms that apply to accounts, listings, payments and sponsorships on RUAGENTIC.',
  alternates: { canonical: '/terms' },
};
export default function Page() {
  return (
    <main className="content-page prose-page">
      <h1>Terms of service.</h1>
      <p>
        Effective September 8, 2026. These terms apply to the RUAGENTIC
        directory at ruagentic.com, operated as{' '}
        {process.env.BUSINESS_NAME || 'RUAGENTIC'}.
      </p>
      <h2>Your account and submissions</h2>
      <p>
        Use accurate account information and keep your sign-in credentials
        secure. Submit projects you maintain or have permission to represent.
        You are responsible for the accuracy and rights to the descriptions,
        links, and other information you submit.
      </p>
      <p>
        By publishing a listing, you permit RUAGENTIC to display, index, and
        distribute that listing through the directory and its public interfaces.
        Public listing information can be read by people, search engines, and AI
        agents.
      </p>
      <h2>Listing options</h2>
      <p>
        A paid listing costs US$49.99 once per project. There is no recurring
        directory subscription. Updates to the same project are included; a
        listing payment cannot be transferred to a different project.
      </p>
      <p>
        The free option requires matching Agentic Protocol JSON, TXT, and README
        publication checks. The check must pass for the project being listed.
        Recheck the files when publishing an update.
      </p>
      <p>
        ruagentic.org’s file convention, generator, and auditor remain free. The
        optional payment on ruagentic.com covers directory publication.
      </p>
      <h2>Publication and payments</h2>
      <p>
        Paid publication follows verified Stripe payment confirmation. Free
        publication follows a successful file check. Payment does not guarantee
        a search position, visitor count, business result, ownership badge, or
        security certification.
      </p>
      <p>
        If a payment is duplicated or a paid listing cannot be delivered,
        contact support with the checkout or listing reference so we can
        investigate and resolve it. Refund requests are reviewed through
        support; applicable statutory rights are unaffected.
      </p>
      <h2>Directory information</h2>
      <p>
        Imported and submitted information may change after collection. Sources
        and check dates are provided to help you evaluate it. Review each
        project’s current documentation, terms, and permissions before
        connecting a client or running a tool.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Follow the <Link href="/guidelines">listing guidelines</Link>. Do not
        publish credentials, impersonate projects, submit deceptive content,
        interfere with the directory, or use it to distribute malware or
        unlawful services.
      </p>
      <p>
        We may correct, restrict, or remove listings and accounts that violate
        these terms, infringe rights, or threaten the service. A refund or
        payment dispute may suspend a listing’s paid eligibility while it is
        resolved.
      </p>
      <h2>Managing your listing</h2>
      <p>
        You can edit or unpublish your listing from the dashboard. Unpublishing
        does not automatically reverse a payment. Contact us for account
        deletion, ownership-related corrections, or billing support.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update the directory and these terms. The effective date above
        identifies the current version. For questions, use{' '}
        <Link href="/contact">the contact page</Link>.
      </p>
    </main>
  );
}
