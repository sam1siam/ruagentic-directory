import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RUAGENTIC',
    short_name: 'RUAGENTIC',
    description:
      'The Agentic Protocol directory of MCP servers, clients and AI agents.',
    start_url: '/',
    display: 'standalone',
    background_color: '#05080c',
    theme_color: '#05080c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
