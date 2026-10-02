export const dynamic = 'force-dynamic';
import type { MetadataRoute } from 'next';
import { catalog } from '@/lib/server/catalog';
import { categories, kinds } from '@/lib/categories';
import { bestCombos } from '@/lib/server/best';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...[
      '',
      '/servers',
      '/clients',
      '/ai-agents',
      '/skills',
      '/plugins',
      '/rules',
      '/evals',
      '/leaderboards',
      '/new',
      '/best',
      ...kinds.map((k) => '/leaderboards/' + k.slug),
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
    ...(await bestCombos()).map((c) => ({
      url: `https://ruagentic.com/best/${c.kind.slug}/${c.category.slug}`,
      changeFrequency: 'daily' as const,
    })),
    ...(await catalog()).map((item) => ({
      url: 'https://ruagentic.com/tools/' + item.slug,
      lastModified: item.publishedAt || item.observedAt,
      changeFrequency: 'weekly' as const,
    })),
  ];
}
