import type { NextConfig } from 'next';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Keep Turbopack inside this repo. Inferring a parent folder (iCloud Documents)
  // makes the first request hang forever after "Ready".
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  watchOptions: {
    pollIntervalMs: 1000,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // iCloud Desktop/Documents: native flock on `.next/dev/lock` can hang `next dev`
  // with no output. Skip barrel-file rewriting so the first compile does not
  // open thousands of package files through iCloud.
  experimental: {
    lockDistDir: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }
    return config;
  },
  async redirects() {
    return [
      // Staff auth lives under /admin/*. Customer login owns public `/login`.
      { source: '/dashboard', destination: '/admin/dashboard', permanent: true },
      { source: '/bookings', destination: '/admin/bookings', permanent: true },
      { source: '/bookings/:path*', destination: '/admin/bookings/:path*', permanent: true },
      { source: '/vehicles', destination: '/admin/vehicles', permanent: true },
      { source: '/vehicles/:path*', destination: '/admin/vehicles/:path*', permanent: true },
      { source: '/calendar', destination: '/admin/calendar', permanent: true },
      { source: '/customers', destination: '/admin/customers', permanent: true },
      { source: '/drivers', destination: '/admin/drivers', permanent: true },
      { source: '/settings', destination: '/admin/settings', permanent: true },

      // Customer portal structure correction — one Book a Car at `/`.
      { source: '/book-a-car', destination: '/', permanent: true },
      { source: '/book-a-car/:path*', destination: '/', permanent: true },
      { source: '/detailing', destination: '/car-detailing', permanent: true },
      { source: '/about', destination: '/about-us', permanent: true },
      { source: '/our-fleet', destination: '/', permanent: true },
      { source: '/pricing', destination: '/', permanent: true },
      { source: '/how-it-works', destination: '/', permanent: true },
      { source: '/contact', destination: '/about-us', permanent: true },
    ];
  },
};

export default nextConfig;
