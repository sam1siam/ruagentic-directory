import Link from 'next/link';
/** A sponsor page disappears when the sponsorship ends or is not approved. */
export default function SponsorNotFound() {
  return (
    <main className="content-page narrow">
      <h1>This sponsorship is not active.</h1>
      <p className="lead">
        The placement has ended, is waiting for approval, or never existed.
        Sponsored cards and tiles are separate from listings, so the sponsor’s
        own directory listing, if it has one, is unaffected.
      </p>
      <div className="actions">
        <Link className="button primary" href="/">
          Explore the directory →
        </Link>
        <Link className="button" href="/advertise">
          Sponsor the directory
        </Link>
      </div>
    </main>
  );
}
