import type { NextConfig } from 'next';

/**
 * API_PROXY_TARGET (server-side): bila diset, web memproksikan
 * `/api/backend/*` ke API tersebut sehingga browser berbicara same-origin —
 * cookie session httpOnly (ADR-005) berfungsi tanpa konfigurasi cross-site.
 * Pasangkan dengan NEXT_PUBLIC_API_URL=/api/backend saat build.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  transpilePackages: ['@flowniaga/ui'],
  output: 'standalone',
  rewrites: async () =>
    apiProxyTarget
      ? [{ source: '/api/backend/:path*', destination: `${apiProxyTarget}/:path*` }]
      : [],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

export default nextConfig;
