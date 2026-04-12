const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: { ignoreDuringBuilds: false },
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://api.anthropic.com https://vfvfulbcaurqkygjrrhh.supabase.co https://*.supabase.co wss://vfvfulbcaurqkygjrrhh.supabase.co https://vercel.live https://*.vercel.live https://api.openai.com https://generativelanguage.googleapis.com https://api.stripe.com https://gmail.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://graph.microsoft.com https://login.microsoftonline.com",
              "frame-src 'self' https://vercel.live https://*.vercel.live",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "worker-src 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}
module.exports = nextConfig
