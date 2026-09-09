import { redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import Link from 'next/link';
import { configured, userClient, adminClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-policy';
import SponsorshipsPanel, {
  type SponsorshipView,
} from '@/components/sponsorships-panel';
import {
  orderMonthly,
  ownedOrders,
  subscriptionFacts,
} from '@/lib/server/sponsorships';
import {
  parseCategories,
  placementById,
  type CreativeEdit,
  type PlacementId,
} from '@/lib/advertising';
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
  let sponsorships: SponsorshipView[] = [];
  try {
    const orders = await ownedOrders({
      id: user.user.id,
      email: user.user.email ?? null,
      confirmed: Boolean(user.user.email_confirmed_at),
    });
    const facts = await Promise.all(
      orders.slice(0, 10).map((o) => subscriptionFacts(o)),
    );
    sponsorships = orders.map((o, i) => ({
      session: o.stripe_session_id,
      product: o.product,
      placement: o.placement as PlacementId,
      placementName: placementById(o.placement)?.name ?? o.placement,
      categories: parseCategories(o.categories),
      approval: o.approval,
      status: facts[i]?.status === 'canceled' ? 'canceled' : o.status,
      livemode: o.livemode,
      page: '/sponsors/' + encodeURIComponent(o.slug),
      tagline: o.tagline,
      description: o.description,
      cta: o.cta,
      url: o.url,
      pending: (o.pending as CreativeEdit | null) ?? null,
      monthly: orderMonthly(o).display,
      renewsAt: facts[i]?.renewsAt ?? null,
      cancelAtPeriodEnd: facts[i]?.cancelAtPeriodEnd ?? false,
      createdAt: o.created_at,
    }));
  } catch {
    sponsorships = [];
  }
  return (
    <>
      {isAdminEmail(user.user.email) && user.user.email_confirmed_at && (
        <div className="content-page admin-entry">
          <Link href="/admin" className="button secondary">
            Open admin →
          </Link>
        </div>
      )}
      <Dashboard
        extra={<SponsorshipsPanel orders={sponsorships} />}
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
    </>
  );
}
