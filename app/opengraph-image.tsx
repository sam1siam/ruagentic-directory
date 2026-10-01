import { ogContentType, ogImage, ogSize } from '@/lib/server/og';
import { directoryStats } from '@/lib/server/stats';
export const alt = 'RUAGENTIC — MCP servers, clients, AI agents and skills';
export const size = ogSize;
export const contentType = ogContentType;
export const revalidate = 3600;
export default async function Image() {
  const stats = await directoryStats();
  return ogImage({
    eyebrow: 'Official listing directory for the Agentic Protocol',
    title: 'MCP servers, clients, AI agents and skills.',
    description:
      'Checked Agentic Protocol files, documentation and connection details for every listing.',
    chips: [
      `${stats.total} listings`,
      `${stats.servers} servers`,
      `${stats.clients} clients`,
      `${stats.products} AI agents`,
      `${stats.skills} skills`,
    ],
    url: 'ruagentic.com',
  });
}
