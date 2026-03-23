/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // ISO 27001 IS-POL-008 (SSDLC): TypeScript errors must not be ignored in production
    // Previously set to true — removed as part of Sprint 30 security close-out
    // If build fails, fix the TS errors before deploying (do not re-enable this)
    ignoreBuildErrors: false,
  },
  eslint:     { ignoreDuringBuilds: false },
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  },
}
module.exports = nextConfig
