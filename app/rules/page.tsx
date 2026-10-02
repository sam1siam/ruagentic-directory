import KindPage, { kindMetadata } from '@/components/kind-page';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => kindMetadata('rules');
export default function Page(props: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return <KindPage slug="rules" {...props} />;
}
