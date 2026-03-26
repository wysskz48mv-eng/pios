/**
 * PIOS — Edge Middleware
 * Security headers · Rate limiting · Session protection · Auth routing
 * PIOS v3.0 | VeritasIQ Technologies Ltd
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
  '/pricing',              // Public marketing page — no auth needed
  '/onboarding',           // New user signup flow — auth checked inside page
  '/api/stripe/webhook',   // Stripe must bypass auth — verified by signature
  '/api/health',
  '/api/health/smoke',     // Smoke test — auth checked inside route
  '/api/auth/connect-gmail', // OAuth initiation — no user session yet
  '/llms.txt',             // Claude for Chrome manifest — public
])

// ── Allowed preview/access tokens ───────────────────────────────────────────
// Set PIOS_ACCESS_TOKEN env var to restrict access during private beta
// Requests must include ?token=<value> or cookie pios_token=<value>
function hasAccessToken(request: NextRequest): boolean {
  const token = process.env.PIOS_ACCESS_TOKEN
  if (!token) return true // No token configured → open
  const queryToken  = request.nextUrl.searchParams.get('token')
  const cookieToken = request.cookies.get('pios_token')?.value
  return queryToken === token || cookieToken === token
}

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
  'X-Robots-Tag':              'noindex, nofollow, noarchive, nosnippet',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://gmail.googleapis.com https://accounts.google.com https://oauth2.googleapis.com",
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

  // ── Access gate — private beta / invite-only ─────────────────────────────
  // If PIOS_ACCESS_TOKEN is set, only requests bearing the token proceed.
  // Exempt: health checks, Stripe webhooks, and Claude for Chrome endpoints.
  const exemptFromGate = pathname === '/api/health' ||
    pathname === '/api/health/smoke' ||
    pathname === '/api/stripe/webhook' ||
    pathname === '/api/claude-context' ||   // Claude for Chrome context API
    pathname === '/llms.txt'                 // Claude for Chrome manifest
  if (!exemptFromGate && !hasAccessToken(request)) {
    // Set the token cookie when provided via query param so subsequent requests pass
    const queryToken = request.nextUrl.searchParams.get('token')
    if (queryToken === process.env.PIOS_ACCESS_TOKEN) {
      const url = new URL(request.url)
      url.searchParams.delete('token')
      const res = NextResponse.redirect(url)
      res.cookies.set('pios_token', queryToken, {
        httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 * 60 * 24 * 30,
      })
      return res
    }
    return new NextResponse(
      '<!DOCTYPE html><html><head><meta name="robots" content="noindex,nofollow"><title>PIOS — Access Restricted</title><style>body{font-family:-apple-system,sans-serif;background:#08090c;color:#eceef4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}.box{text-align:center;padding:40px;}.logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#9b87f5,#5b8def);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;margin:0 auto 20px;}.h{font-size:20px;font-weight:700;margin-bottom:8px;}.s{font-size:14px;color:#7a8098;}</style></head><body><div class="box"><div class="logo">P</div><div class="h">Access Restricted</div><div class="s">PIOS is currently in private access.<br>Contact <a href="mailto:info@veritasiq.io" style="color:#9b87f5;text-decoration:none;">info@veritasiq.io</a> for access.</div></div></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex, nofollow' } }
    )
  }

  // Build base response and apply security headers to everything
  // ── CSP Nonce (A.14.2) — per-request nonce eliminates unsafe-inline risk
  // Set on response as x-nonce header so layout.tsx can inject into <script> tags
  const nonce = btoa(globalThis.crypto.randomUUID())
  const noncedCSP = SEC_HEADERS['Content-Security-Policy']
    .replace("script-src 'self' 'unsafe-eval' 'unsafe-inline'",
             `script-src 'self' 'unsafe-eval' 'nonce-${nonce}'`)
    .replace("style-src 'self' 'unsafe-inline'",
             `style-src 'self' 'nonce-${nonce}'`)

  let response = NextResponse.next({ request })
  for (const [k, v] of Object.entries(SEC_HEADERS)) response.headers.set(k, v)
  response.headers.set('Content-Security-Policy', noncedCSP)
  response.headers.set('x-nonce', nonce)

  // Static assets — headers only, skip auth
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') ||
      /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/.test(pathname)) {
    return response
  }

  // Public paths — headers only
  if (Array.from(PUBLIC_PATHS).some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return response
  }

  // ── CSRF protection (ISO 27001 A.8.26) ─────────────────────────────────────
  const method = request.method.toUpperCase()
  if (['POST','PUT','PATCH','DELETE'].includes(method) &&
      !pathname.startsWith('/api/stripe/webhook') &&
      !pathname.startsWith('/auth/')) {
    const origin  = request.headers.get('origin')  ?? ''
    const referer = request.headers.get('referer') ?? ''
    const host    = request.headers.get('host')    ?? ''
    const allowed = [
      `https://${host}`, 'http://localhost:3000', 'http://localhost:3001',
      process.env.NEXT_PUBLIC_APP_URL ?? '',
    ].filter(Boolean)
    const ok = !origin || !referer ||
      allowed.some(o => origin.startsWith(o) || referer.startsWith(o))
    if (!ok) {
      return new NextResponse(
        JSON.stringify({ error: 'CSRF validation failed' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } }
      )
    }
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
        setAll(cs: { name: string; value: string; options?: Record<string,unknown> }[]) {
          cs.forEach(({ name, value }: { name: string; value: string; options?: Record<string,unknown> }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          for (const [k, v] of Object.entries(SEC_HEADERS)) response.headers.set(k, v)
          cs.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string,unknown> }) =>
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
