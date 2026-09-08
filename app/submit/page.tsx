import { configured, userClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth-form';
import SubmissionForm from '@/components/submission-form';
export const metadata = {
  title: 'Submit your project',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; plan?: string }>;
}) {
  const p = await searchParams;
  if (!configured())
    return (
      <main className="auth-page">
        <AuthForm next="/submit" available={false} />
      </main>
    );
  const { data } = await (await userClient()).auth.getUser();
  if (!data.user)
    redirect(
      '/login?next=' +
        encodeURIComponent(
          '/submit' +
            (p.id
              ? '?id=' + encodeURIComponent(p.id)
              : p.plan === 'paid'
                ? '?plan=paid'
                : ''),
        ),
    );
  return (
    <SubmissionForm
      id={p.id}
      email={data.user.email ?? ''}
      initialPlan={p.plan === 'paid' ? 'payment' : 'agentic'}
    />
  );
}
