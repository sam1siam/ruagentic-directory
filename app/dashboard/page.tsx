import { redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { configured, userClient, adminClient } from '@/lib/supabase/server';
export const metadata = {
  title: 'Your dashboard',
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!configured()) redirect('/login');
  const client = await userClient(),
    { data: user } = await client.auth.getUser();
  if (!user.user) redirect('/login?next=/dashboard');
  const db = adminClient();
  const [submissions, bookmarks, events] = await Promise.all([
    client
      .from('submissions')
      .select('id,payload,state,slug,revision,updated_at')
      .order('updated_at', { ascending: false })
      .limit(100),
    client
      .from('bookmarks')
      .select('slug,directory_entries(data)')
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('publication_events')
      .select('submission_id,revision')
      .in(
        'submission_id',
        (await client.from('submissions').select('id')).data?.map(
          (r) => r.id,
        ) ?? [],
      ),
  ]);
  if (submissions.error || bookmarks.error || events.error)
    throw new Error('Your dashboard could not be loaded.');
  return (
    <Dashboard
      email={user.user.email ?? ''}
      submissions={(submissions.data ?? []).map((s) => ({
        ...s,
        hasUnpublishedChanges: !(events.data ?? []).some(
          (e) => e.submission_id === s.id && e.revision === s.revision,
        ),
      }))}
      saved={(bookmarks.data ?? []).flatMap((r) =>
        (
          r.directory_entries as unknown as {
            data: { slug: string; name: string; summary: string };
          } | null
        )?.data
          ? [
              (
                r.directory_entries as unknown as {
                  data: { slug: string; name: string; summary: string };
                }
              ).data,
            ]
          : [],
      )}
    />
  );
}
