import Link from 'next/link';
/** Shown with a 404 status for slugs that never existed and for listings
 *  their owner has unpublished or deleted. No redirect: an owner can
 *  republish under the same address, so the address must not be marked as
 *  permanently moved. */
export default function ListingNotFound() {
  return (
    <main className="content-page narrow">
      <h1>This listing is not available.</h1>
      <p className="lead">
        It may have been unpublished or deleted by its owner, or the address may
        be wrong. If you are the owner, sign in to your dashboard to republish
        or edit it.
      </p>
      <div className="actions">
        <Link className="button primary" href="/">
          Explore the directory →
        </Link>
        <Link className="button" href="/dashboard">
          Your dashboard
        </Link>
      </div>
    </main>
  );
}
