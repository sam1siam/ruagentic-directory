'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="content-page narrow">
      <h1>This page could not load.</h1>
      <p>Your saved listings are preserved. Please try again.</p>
      <div className="actions">
        <Button onClick={reset}>Try again</Button>
        <Link className="text-link" href="/">
          Back to the directory
        </Link>
      </div>
    </main>
  );
}
