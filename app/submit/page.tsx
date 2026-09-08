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
  const query = new URLSearchParams({
    ...(p.id ? { id: p.id } : {}),
    ...(p.plan === 'paid' ? { plan: 'paid' } : {}),
  });
  const next = '/submit' + (query.size ? '?' + query : '');
  if (!configured())
    return (
      <main className="auth-page">
        <AuthForm next={next} available={false} />
      </main>
    );
  const { data } = await (await userClient()).auth.getUser();
  if (!data.user) redirect('/login?next=' + encodeURIComponent(next));
  return (
    <SubmissionForm
      key={p.id ?? 'new'}
      id={p.id}
      email={data.user.email ?? ''}
      initialPlan={p.plan === 'paid' ? 'payment' : 'agentic'}
    />
  );
}
