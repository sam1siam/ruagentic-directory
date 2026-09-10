import { ogContentType, ogImage, ogSize } from '@/lib/server/og';
import { catalog } from '@/lib/server/catalog';
import { kindBySlug } from '@/lib/categories';
export const alt = 'Browse by type on RUAGENTIC';
export const size = ogSize;
export const contentType = ogContentType;
export const revalidate = 3600;
export default async function Image() {
  const page = kindBySlug('ai-agents')!;
  const count = (await catalog()).filter((i) => i.kind === page.kind).length;
  return ogImage({
    eyebrow: 'Browse by type',
    title: page.name + '.',
    description: page.description,
    chips: [`${count} listings`],
    url: 'ruagentic.com/ai-agents',
  });
}
