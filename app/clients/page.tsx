import KindPage, { kindMetadata } from '@/components/kind-page';
export const dynamic = 'force-dynamic';
export const metadata = kindMetadata('clients');
export default function Page(props: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return <KindPage slug="clients" {...props} />;
}
