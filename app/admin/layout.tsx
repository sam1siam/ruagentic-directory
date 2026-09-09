import Link from 'next/link';
import { requireAdmin, adOrders, reportRows } from '@/lib/server/admin';
import AdminTabs from '@/components/admin-tabs';
import './admin.css';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  // Badges only; the tabs themselves report a missing migration in detail.
  const [orders, reports] = await Promise.all([adOrders(), reportRows()]).catch(
    () => [[], []] as const,
  );
  const pending = orders.filter(
    (o) =>
      o.status === 'active' &&
      (o.approval === 'pending' || (o.pending && o.approval === 'approved')),
  ).length;
  const open = reports.filter((r) => r.state === 'open').length;
  return (
    <main className="content-page admin-page">
      <header className="admin-head">
        <div>
          <span className="admin-kicker">RUAGENTIC · ADMIN</span>
          <h1>Mission control.</h1>
        </div>
        <div className="admin-identity">
          <span>{admin.email}</span>
          <Link href="/dashboard">Your dashboard →</Link>
        </div>
      </header>
      <AdminTabs pending={pending} openReports={open} />
      {children}
    </main>
  );
}
