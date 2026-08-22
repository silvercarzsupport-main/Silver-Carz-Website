import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      // Staff auth lives under /admin/*. Customer login owns public `/login`.
      { source: '/forgot-password', destination: '/admin/forgot-password', permanent: true },
      { source: '/reset-password', destination: '/admin/reset-password', permanent: true },
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
