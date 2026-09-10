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
  ['/admin/health', 'Data health'],
  ['/admin/duplicates', 'Duplicates'],
] as const;
export default function AdminTabs({
  pending,
  openReports,
  duplicates = 0,
}: {
  pending: number;
  openReports: number;
  duplicates?: number;
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
              : href === '/admin/duplicates'
                ? duplicates
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
