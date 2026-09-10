import { ogContentType, ogImage, ogSize } from '@/lib/server/og';
import { catalog } from '@/lib/server/catalog';
import { categoryBySlug } from '@/lib/categories';
export const alt = 'Category on RUAGENTIC';
export const size = ogSize;
export const contentType = ogContentType;
export const revalidate = 3600;
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const category = categoryBySlug((await params).slug);
  if (!category)
    return ogImage({
      eyebrow: 'RUAGENTIC directory',
      title: 'Category not found.',
      description: 'Browse MCP servers, clients and AI agents by category.',
      url: 'ruagentic.com/categories',
    });
  const count = (await catalog()).filter(
    (i) => i.category === category.name,
  ).length;
  return ogImage({
    eyebrow: 'Category',
    title: category.name + '.',
    description: category.description,
    chips: [`${count} listings`],
    url: 'ruagentic.com/categories/' + category.slug,
  });
}
