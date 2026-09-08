import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="content-page narrow">
      <span className="eyebrow">404</span>
      <h1>That page is not here.</h1>
      <p>
        The listing may have moved or been removed. Explore the directory to
        find another connection.
      </p>
      <div className="actions">
        <Link className="button primary" href="/">
          Explore tools ↗
        </Link>
      </div>
    </main>
  );
}
