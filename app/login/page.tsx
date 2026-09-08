import AuthForm from '@/components/auth-form';
import { SessionLog, NetworkRail } from '@/components/auth-rails';
import { configured, userClient } from '@/lib/supabase/server';
import { directoryStats } from '@/lib/server/stats';
import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/listing';
export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const p = await searchParams;
  if (configured() && !p.error) {
    const { data } = await (await userClient()).auth.getUser();
    if (data.user) redirect(safeNext(p.next ?? null));
  }
  const stats = await directoryStats();
  return (
    <main className="auth-page">
      {p.error && (
        <p className="notice error" role="alert">
          {p.error === 'oauth-cancelled'
            ? 'GitHub sign-in was cancelled. You can try again or use an email link.'
            : p.error === 'oauth'
              ? 'GitHub sign-in could not be completed. Start again from this page.'
              : p.error === 'unavailable'
                ? 'Sign-in is temporarily unavailable. Please try again.'
                : 'That email link has expired or was already used. Request a new link below.'}
        </p>
      )}
      <div className="auth-frame">
        <SessionLog ready={configured()} />
        <AuthForm next={safeNext(p.next ?? null)} available={configured()} />
        <NetworkRail stats={stats} />
      </div>
    </main>
  );
}
