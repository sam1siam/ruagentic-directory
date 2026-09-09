import Link from 'next/link';
export const metadata = { title: 'Privacy policy' };
export default function Page() {
  return (
    <main className="content-page prose-page">
      <h1>Privacy policy.</h1>
      <p>
        Effective September 8, 2026. This policy describes how the RUAGENTIC
        directory at ruagentic.com uses information supplied through the site.
      </p>
      <h2>Information we collect</h2>
      <p>
        When you register, we store your email address and account identifiers.
        Supabase handles account authentication. We store listing details, saved
        tools, publication checks, reports, and the records needed to process a
        listing payment and send confirmation messages.
      </p>
      <p>
        If you choose GitHub sign-in, Supabase receives your GitHub account
        identifier, public profile information, and email address to create or
        connect your directory account. GitHub sign-in does not give RUAGENTIC
        access to your private repositories.
      </p>
      <p>
        Project descriptions, public URLs, connection instructions, source
        labels, and publication-check dates become public when a listing is
        published. Your account email, saved tools, internal reports, and
        payment identifiers are not shown on the listing.
      </p>
      <h2>Payments</h2>
      <p>
        Stripe processes payment information on its checkout page. RUAGENTIC
        stores payment and checkout identifiers, amounts, currency, status, and
        publication eligibility. We do not receive or store your full card
        number.
      </p>
      <h2>Public website checks</h2>
      <p>
        When you import a URL, our server reads public project information. When
        you run the free publication checker, the project profile and optional
        README URLs are sent to the Agentic Protocol auditor at ruagentic.org.
        We retain its report to explain the result and establish listing
        eligibility.
      </p>
      <h2>Service providers</h2>
      <p>
        The directory uses Vercel for hosting, Supabase for accounts and data,
        Stripe for payments, Resend for transactional email, and GitHub for
        optional GitHub sign-in. These providers process information needed to
        operate the requested service. Their processing may occur outside your
        country.
      </p>
      <h2>Cookies and browser storage</h2>
      <p>
        Authentication uses necessary cookies to keep you signed in. The
        comparison feature stores selected public listing identifiers in your
        browser. Google Tag Manager loads our site measurement tags, which may
        set cookies or similar identifiers to count visits and understand how
        the directory is used. We do not sell personal information through this
        directory.
      </p>
      <h2>Retention and your choices</h2>
      <p>
        We retain account and submission information while it is needed to
        provide your account, operate listings, investigate abuse, and maintain
        required payment records. You can edit or unpublish your listings from
        the dashboard. Contact us to request access, correction, or deletion of
        account data; payment records may need to be retained where required.
      </p>
      <p>
        Unpublishing removes the public directory page. It does not remove
        copies that other services have already collected from a public listing.
      </p>
      <h2>Contact</h2>
      <p>
        Use <Link href="/contact">our contact page</Link> for privacy requests.
        Send only the information needed to identify your account and request.
      </p>
    </main>
  );
}
