import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/submit',
        '/login',
        '/reset-password',
        '/auth/',
        '/api/account',
        '/api/submissions',
        '/api/checkout',
        '/api/bookmarks',
        '/api/reports',
      ],
    },
    sitemap: 'https://ruagentic.com/sitemap.xml',
  };
}
