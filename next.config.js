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
  // env vars read directly from process.env — no fallback to prevent silent misconfiguration
}
module.exports = nextConfig
