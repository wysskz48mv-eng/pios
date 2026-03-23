/**
 * PIOS — Edge Middleware
 * Security headers · Rate limiting · Session protection · Auth routing
 * PIOS v1.0 | VeritasIQ Technologies Ltd
 *
 * ISO 27001 A.9.4 — Access control enforcement
 * ISO 27001 A.12.6 — Technical vulnerability management
 * ISO 27001 A.14.1 — Security requirements
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/auth/login',
  '/auth/signup',
  '/auth/verify',
  '/auth/callback',
  '/auth/reset-password',
  '/privacy',
  '/terms',
  '/api/stripe/webhook',   // Stripe must bypass auth — verified by signature
  '/api/health',
])

// ── ISO 27001 A.14.2 — Security response headers ────────────────────────────
const SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options':    'nosniff',
  'X-Frame-Options':           'DENY',
  'X-XSS-Protection':          '1; mode=block',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'X-IP-Notice':               '\u00A9 2026 VeritasIQ Technologies Ltd. Proprietary and confidential.',
  'X-Content-Owner':           'VeritasIQ Technologies Ltd',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://gmail.googleapis.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
}

// ── Rate limiting — 100 req/15min per IP ────────────────────────────────────
const ipAttempts = new Map<string, { count: number; resetAt: number }>()
function rateLimit(ip: string, limit = 100, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const e = ipAttempts.get(ip)
  if (!e || e.resetAt < now) { ipAttempts.set(ip, { count: 1, resetAt: now + windowMs }); return true }
  if (e.count >= limit) return false
  e.count++; return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const PIOS_BLOCKED = ['/api/debug', '/.env', '/.git', '/api/openapi']
  if (PIOS_BLOCKED.some(p => pathname.startsWith(p))) {
    return new NextResponse('Not found.', { status: 404 })
  }

  const { pathname } = request.nextUrl

  // Build base response and apply security headers to everything
  let response = NextResponse.next({ request })
  for (const [k, v] of Object.entries(SEC_HEADERS)) response.headers.set(k, v)

  // Static assets — headers only, skip auth
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') ||
      /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/.test(pathname)) {
    return response
  }

  // Public paths — headers only
  if (Array.from(PUBLIC_PATHS).some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return response
  }

  // Rate limiting
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  if (!rateLimit(ip)) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } }
    )
  }

  // Supabase session check — refresh token if needed
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cs: { name: string; value: string; options?: any }[]) {
          cs.forEach(({ name, value }: { name: string; value: string; options?: any }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          for (const [k, v] of Object.entries(SEC_HEADERS)) response.headers.set(k, v)
          cs.forEach(({ name, value, options }: { name: string; value: string; options?: any }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated — redirect or 401
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorised' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } }
      )
    }
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', encodeURIComponent(pathname))
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user on login page — redirect to dashboard
  if (pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/platform/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
