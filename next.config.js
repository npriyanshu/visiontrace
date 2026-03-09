/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for PWA — serves the app from root
  trailingSlash: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          // Camera permission policy
          { key: 'Permissions-Policy',     value: 'camera=self' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
