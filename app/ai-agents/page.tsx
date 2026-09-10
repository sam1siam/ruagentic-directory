import KindPage, { kindMetadata } from '@/components/kind-page';
export const dynamic = 'force-dynamic';
export const metadata = kindMetadata('ai-agents');
export default function Page(props: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return <KindPage slug="ai-agents" {...props} />;
}
