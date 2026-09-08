'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, Copy, Flag, Check, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client-api';
export default function ListingActions({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false),
    [message, setMessage] = useState(''),
    [report, setReport] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api('/api/bookmarks', undefined, 'GET')
      .then((data) => setSaved(data.slugs.includes(slug)))
      .catch(() => {});
  }, [slug]);
  async function bookmark() {
    setBusy(true);
    setMessage('');
    try {
      await api('/api/bookmarks', { slug }, saved ? 'DELETE' : 'POST');
      setSaved(!saved);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="listing-actions">
        <Button variant="outline" disabled={busy} onClick={bookmark}>
          {saved ? <Check size={16} /> : <Bookmark size={16} />}{' '}
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                'https://ruagentic.com/tools/' + slug,
              );
              setMessage('Listing link copied.');
            } catch {
              setMessage('Copy the page URL from your browser.');
            }
          }}
        >
          <Copy size={16} />
          Share
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            let current: string[] = [];
            try {
              const stored = JSON.parse(
                localStorage.getItem('ruagentic:compare') ?? '[]',
              );
              if (Array.isArray(stored))
                current = stored.filter((v) => typeof v === 'string');
            } catch {}
            const next = Array.from(new Set([...current, slug])).slice(-4);
            try {
              localStorage.setItem('ruagentic:compare', JSON.stringify(next));
            } catch {}
            window.location.assign(
              '/compare?tools=' + next.map(encodeURIComponent).join(','),
            );
          }}
        >
          <GitCompareArrows size={16} />
          Compare
        </Button>
        <Button variant="ghost" onClick={() => setReport(!report)}>
          <Flag size={15} />
          Report
        </Button>
      </div>
      {message && (
        <output className="notice">
          {message}{' '}
          {message.includes('Sign in') && <Link href="/login">Sign in ↗</Link>}
        </output>
      )}
      {report && (
        <form
          className="report-form stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api('/api/reports', { slug, reason });
              setReport(false);
              setReason('');
              setMessage(
                'Your report has been received. Thank you for helping keep the directory accurate.',
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            What needs to change?
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </label>
          <Button disabled={busy} type="submit">
            Send report
          </Button>
        </form>
      )}
    </>
  );
}
