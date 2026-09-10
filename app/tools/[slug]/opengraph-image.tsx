import { ogContentType, ogImage, ogSize } from '@/lib/server/og';
import { listingBySlug } from '@/lib/server/catalog';
import { kindLabel } from '@/lib/badge';
export const alt = 'Listing on RUAGENTIC';
export const size = ogSize;
export const contentType = ogContentType;
export const revalidate = 3600;
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const item = await listingBySlug((await params).slug);
  if (!item)
    return ogImage({
      eyebrow: 'RUAGENTIC directory',
      title: 'Listing not found.',
      description: 'Browse MCP servers, clients and AI agents on RUAGENTIC.',
      url: 'ruagentic.com',
    });
  return ogImage({
    eyebrow: `${kindLabel(item.kind)} · ${item.category}`,
    title: item.name,
    description: item.summary,
    chips: [
      kindLabel(item.kind),
      item.category,
      ...(item.pricing && item.pricing !== 'unknown' ? [item.pricing] : []),
    ],
    badge: item.agenticCheckedAt ? 'Agentic Protocol verified' : undefined,
    url: 'ruagentic.com/tools/' + item.slug,
  });
}
