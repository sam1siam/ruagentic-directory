'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="content-page narrow">
      <h1>This page could not load.</h1>
      <p className="lead">
        Your saved listings are preserved. Please try again.
      </p>
      <div className="actions">
        <button type="button" className="button primary" onClick={reset}>
          Try again →
        </button>
        <Link className="text-link" href="/">
          Back to the directory
        </Link>
      </div>
    </main>
  );
}
