import AuthForm from '@/components/auth-form';
import { configured, userClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
export const metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (configured()) {
    const { data } = await (await userClient()).auth.getUser();
    if (!data.user) redirect('/login');
  }
  return (
    <main className="auth-page">
      <AuthForm reset available={configured()} />
    </main>
  );
}
