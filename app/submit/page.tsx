import { configured, userClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth-form';
import SubmissionForm from '@/components/submission-form';
import { listingBySlug } from '@/lib/server/catalog';
import { listingInputFrom } from '@/lib/listing';
export const metadata = {
  title: 'Submit your project',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; plan?: string; claim?: string }>;
}) {
  const p = await searchParams;
  const query = new URLSearchParams({
    ...(p.id ? { id: p.id } : {}),
    ...(p.plan === 'paid' ? { plan: 'paid' } : {}),
    ...(p.claim ? { claim: p.claim } : {}),
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
  // Claiming an imported listing starts the form filled with its details;
  // publishing merges the imported entry into the owner's listing.
  const claimed = p.claim && !p.id ? await listingBySlug(p.claim) : null;
  const claim =
    claimed && claimed.imported && !claimed.submitted
      ? (() => {
          try {
            return {
              slug: claimed.slug,
              name: claimed.name,
              input: listingInputFrom(claimed),
            };
          } catch {
            return undefined;
          }
        })()
      : undefined;
  return (
    <SubmissionForm
      key={p.id ?? (claim ? 'claim-' + claim.slug : 'new')}
      id={p.id}
      email={data.user.email ?? ''}
      initialPlan={p.plan === 'paid' ? 'payment' : 'agentic'}
      claim={claim}
    />
  );
}
