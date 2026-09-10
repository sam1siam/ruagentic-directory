import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/collections', destination: '/categories', permanent: true },
      { source: '/products', destination: '/ai-agents', permanent: true },
      {
        source: '/collections/:path*',
        destination: '/categories',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.ruagentic.com' }],
        destination: 'https://ruagentic.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Everything except the auth flow and the embed cards refuses framing.
      {
        source: '/((?!auth/|embed/).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      {
        source: '/auth/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      // Embed cards are made to be framed by other sites.
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *; object-src 'none'; base-uri 'self'",
          },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      {
        source: '/api/:name(cron|webhooks)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/auth/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin' },
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default nextConfig;
