export const dynamic = 'force-dynamic';
import type { MetadataRoute } from 'next';
import { catalog } from '@/lib/server/catalog';
import { categories } from '@/lib/categories';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...[
      '',
      '/servers',
      '/clients',
      '/ai-agents',
      '/categories',
      ...categories.map((c) => '/categories/' + c.slug),
      '/advertise',
      '/pricing',
      '/about',
      '/guidelines',
      '/developers',
      '/contact',
      '/privacy',
      '/terms',
    ].map((path) => ({
      url: 'https://ruagentic.com' + path,
      changeFrequency: 'weekly' as const,
    })),
    ...(await catalog()).map((item) => ({
      url: 'https://ruagentic.com/tools/' + item.slug,
      lastModified: item.publishedAt || item.observedAt,
      changeFrequency: 'weekly' as const,
    })),
  ];
}
