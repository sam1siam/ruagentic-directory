import AuthForm from '@/components/auth-form';
import { configured } from '@/lib/supabase/server';
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
  return (
    <main className="auth-page">
      {p.error && (
        <p className="notice error">
          That sign-in link could not be verified. Request a new link and try
          again in the same browser.
        </p>
      )}
      <AuthForm next={safeNext(p.next ?? null)} available={configured()} />
    </main>
  );
}
