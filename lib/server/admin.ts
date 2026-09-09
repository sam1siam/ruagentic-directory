import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { isAdminEmail } from '../admin-policy';
import { parseCategories, quote, type PlacementId } from '../advertising';
import { adminClient, configured, userClient } from '../supabase/server';

export type Admin = { id: string; email: string };
/** The signed-in admin, or null. Cached per request. */
export const currentAdmin = cache(async (): Promise<Admin | null> => {
  if (!configured()) return null;
  try {
    const client = await userClient();
    const { data } = await client.auth.getUser();
    const user = data.user;
    if (!user?.email || !user.email_confirmed_at || !isAdminEmail(user.email))
      return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
});
/** Signed-out visitors go to sign-in; signed-in non-admins get a 404 so the
 *  area is not advertised. */
export async function requireAdmin(next = '/admin'): Promise<Admin> {
  if (!configured()) redirect('/login?next=' + encodeURIComponent(next));
  const client = await userClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect('/login?next=' + encodeURIComponent(next));
  if (!data.user.email || !isAdminEmail(data.user.email)) notFound();
  if (!data.user.email_confirmed_at) notFound();
  return { id: data.user.id, email: data.user.email };
}

// ---------------------------------------------------------------- time windows
export const DAY = 86400000;
export const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};
export const since = (days: number) =>
  new Date(Date.now() - days * DAY).toISOString();
export const day = (iso: string) => iso.slice(0, 10);

export type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  provider: string;
};
/** Every account (up to 5,000), newest first. */
export const allUsers = cache(async (): Promise<AuthUser[]> => {
  const db = adminClient();
  const users: AuthUser[] = [];
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    for (const u of data.users)
      users.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        provider: (u.app_metadata?.provider as string) ?? 'email',
      });
    if (data.users.length < 1000) break;
  }
  return users.sort((a, b) => b.created_at.localeCompare(a.created_at));
});

export type PublicationEvent = {
  submission_id: string;
  revision: number;
  method: 'payment' | 'agentic';
  created_at: string;
};
export const publicationEvents = cache(
  async (): Promise<PublicationEvent[]> => {
    const { data, error } = await adminClient()
      .from('publication_events')
      .select('submission_id,revision,method,created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as PublicationEvent[];
  },
);

export type AdOrder = {
  stripe_session_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  customer_email: string | null;
  slug: string;
  placement: string;
  product: string;
  tagline: string;
  description: string;
  cta: string;
  categories: string;
  url: string;
  status: string;
  approval: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string;
  livemode: boolean;
  owner_id?: string | null;
  pending?: {
    tagline: string;
    description: string;
    cta: string;
    categories: string[];
  } | null;
  created_at: string;
  updated_at: string;
};
export const adOrders = cache(async (): Promise<AdOrder[]> => {
  const { data, error } = await adminClient()
    .from('ad_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as AdOrder[];
});

export type SubmissionRow = {
  id: string;
  owner_id: string;
  name: string;
  kind: string;
  homepage: string;
  state: string;
  slug: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  method: 'payment' | 'agentic' | null;
  published_at: string | null;
  visible: boolean | null;
  owner_email: string | null;
};
export const submissionRows = cache(async (): Promise<SubmissionRow[]> => {
  const db = adminClient();
  const [subs, events, entries, users] = await Promise.all([
    db
      .from('submissions')
      .select('id,owner_id,payload,state,slug,revision,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    publicationEvents(),
    db.from('directory_entries').select('submission_id,visible').limit(5000),
    allUsers(),
  ]);
  if (subs.error) throw subs.error;
  if (entries.error) throw entries.error;
  const email = new Map(users.map((u) => [u.id, u.email]));
  const visible = new Map(
    (entries.data ?? []).map((e) => [e.submission_id as string, e.visible]),
  );
  const latest = new Map<string, PublicationEvent>();
  for (const e of events)
    if (!latest.has(e.submission_id)) latest.set(e.submission_id, e);
  return (subs.data ?? []).map((s) => {
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    const str = (v: unknown, fallback = '') =>
      typeof v === 'string' ? v : fallback;
    const event = latest.get(s.id as string);
    return {
      id: s.id as string,
      owner_id: s.owner_id as string,
      name: str(payload.name, '(untitled)'),
      kind: str(payload.kind),
      homepage: str(payload.homepage),
      state: s.state as string,
      slug: (s.slug as string | null) ?? null,
      revision: s.revision as number,
      created_at: s.created_at as string,
      updated_at: s.updated_at as string,
      method: event?.method ?? null,
      published_at: event?.created_at ?? null,
      visible: visible.get(s.id as string) ?? null,
      owner_email: email.get(s.owner_id as string) ?? null,
    };
  });
});

export type ReportRow = {
  id: string;
  owner_id: string | null;
  slug: string | null;
  reason: string;
  state: string;
  resolution: string;
  resolved_at: string | null;
  created_at: string;
  listing_name: string | null;
  reporter_email: string | null;
};
export const reportRows = cache(async (): Promise<ReportRow[]> => {
  const db = adminClient();
  const [reports, users] = await Promise.all([
    db
      .from('listing_reports')
      .select(
        'id,owner_id,slug,reason,state,resolution,resolved_at,created_at,directory_entries(data)',
      )
      .order('created_at', { ascending: false })
      .limit(300),
    allUsers(),
  ]);
  if (reports.error) throw reports.error;
  const email = new Map(users.map((u) => [u.id, u.email]));
  return (reports.data ?? []).map((r) => {
    const entry = r.directory_entries as unknown as {
      data?: { name?: string };
    } | null;
    return {
      id: r.id as string,
      owner_id: (r.owner_id as string | null) ?? null,
      slug: (r.slug as string | null) ?? null,
      reason: r.reason as string,
      state: r.state as string,
      resolution: String(r.resolution ?? ''),
      resolved_at: (r.resolved_at as string | null) ?? null,
      created_at: r.created_at as string,
      listing_name: entry?.data?.name ?? null,
      reporter_email: r.owner_id
        ? (email.get(r.owner_id as string) ?? null)
        : null,
    };
  });
});

export type OutboxRow = {
  id: string;
  recipient: string;
  state: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  payload: { name?: string; slug?: string; method?: string };
};
export const outboxRows = cache(async (): Promise<OutboxRow[]> => {
  const { data, error } = await adminClient()
    .from('email_outbox')
    .select(
      'id,recipient,state,attempts,last_error,next_attempt_at,created_at,payload',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as OutboxRow[];
});

export type ActionRow = {
  id: string;
  actor: string;
  action: string;
  target: string;
  note: string;
  created_at: string;
};
export const actionRows = cache(async (): Promise<ActionRow[]> => {
  const { data, error } = await adminClient()
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ActionRow[];
});

/** Counts for the overview tiles and the daily chart. */
export async function overview(days: number) {
  const [users, events, orders, subs, reports, outbox] = await Promise.all([
    allUsers(),
    publicationEvents(),
    adOrders(),
    submissionRows(),
    reportRows(),
    outboxRows(),
  ]);
  const today = startOfToday();
  const window = (rows: { created_at: string }[], from: string) =>
    rows.filter((r) => r.created_at >= from).length;
  const free = events.filter((e) => e.method === 'agentic');
  const paid = events.filter((e) => e.method === 'payment');
  const windows = [
    ['Today', today],
    ['7 days', since(7)],
    ['30 days', since(30)],
    ['All time', '1970-01-01'],
  ] as const;
  const tiles = windows.map(([label, from]) => ({
    label,
    signups: window(users, from),
    free: window(free, from),
    paid: window(paid, from),
    sponsors: window(orders, from),
    submissions: window(subs, from),
  }));
  const series: {
    date: string;
    signups: number;
    free: number;
    paid: number;
    sponsors: number;
  }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = day(new Date(Date.now() - i * DAY).toISOString());
    series.push({
      date,
      signups: users.filter((u) => day(u.created_at) === date).length,
      free: free.filter((e) => day(e.created_at) === date).length,
      paid: paid.filter((e) => day(e.created_at) === date).length,
      sponsors: orders.filter((o) => day(o.created_at) === date).length,
    });
  }
  return {
    tiles,
    series,
    pendingSponsors: orders.filter(
      (o) => o.approval === 'pending' && o.status === 'active',
    ).length,
    activeSponsors: orders.filter(
      (o) => o.approval === 'approved' && o.status === 'active',
    ).length,
    monthlyRevenueCents: orders
      .filter(
        (o) => o.approval === 'approved' && o.status === 'active' && o.livemode,
      )
      .reduce((sum, o) => sum + orderAmount(o), 0),
    openReports: reports.filter((r) => r.state === 'open').length,
    emailProblems: outbox.filter((m) =>
      ['failed', 'uncertain'].includes(m.state),
    ).length,
    liveListings: subs.filter((s) => s.state === 'published' && s.visible)
      .length,
    drafts: subs.filter((s) => s.state === 'editing').length,
  };
}
export function orderAmount(order: Pick<AdOrder, 'placement' | 'categories'>) {
  return quote(
    order.placement as PlacementId,
    parseCategories(order.categories),
  ).amount;
}
