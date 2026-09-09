'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
const tabs = [
  ['/admin', 'Overview'],
  ['/admin/sponsors', 'Sponsorships'],
  ['/admin/submissions', 'Submissions'],
  ['/admin/accounts', 'Accounts'],
  ['/admin/reports', 'Reports'],
  ['/admin/email', 'Email'],
] as const;
export default function AdminTabs({
  pending,
  openReports,
}: {
  pending: number;
  openReports: number;
}) {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {tabs.map(([href, label]) => {
        const badge =
          href === '/admin/sponsors'
            ? pending
            : href === '/admin/reports'
              ? openReports
              : 0;
        const current =
          href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
          >
            {label}
            {badge > 0 && <b>{badge}</b>}
          </Link>
        );
      })}
    </nav>
  );
}
