/**
 * PIOS — Edge Middleware
 * Security headers · Rate limiting · Session protection · Auth routing
 * PIOS v3.2 | VeritasIQ Technologies Ltd
 *
 * ISO 27001 A.9.4 — Access control enforcement
 * ISO 27001 A.12.6 — Technical vulnerability management
 * ISO 27001 A.14.1 — Security requirements
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/redis-rate-limit'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'

const MIDDLEWARE_RATE_LIMIT = {
  max: 100,
  windowMs: 15 * 60 * 1000,
}

const PUBLIC_PATHS = new Set([
  '/beta',
  '/acceptable-use',
  '/auth/login',
  '/auth/signup',
  '/auth/verify',
  '/auth/callback',
  '/cookies',
  '/auth/reset-password',
  '/',                     // Landing page — public marketing, auth checked in server component
  '/research',             // White paper — public marketing page
  '/privacy',
  '/terms',
  '/pricing',              // Public marketing page — no auth needed
  '/api/stripe/webhook',   // Stripe must bypass auth — verified by signature
  '/api/health',
  '/api/notifications/generate', // Cron/internal call — auth checked inside route
  '/api/auth/connect-gmail', // OAuth initiation — no user session yet
  '/api/cron',               // Cron jobs — auth via CRON_SECRET header, not session
  '/api/admin/send-uat-invites', // UAT emails — auth via CRON_SECRET
  '/llms.txt',             // Claude for Chrome manifest — public
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
  'X-Robots-Tag':              'noindex, nofollow, noarchive, nosnippet',
  // CSP defined in next.config.js headers() to avoid conflicts
}

const ONBOARDING_FEATURE_LAUNCH_DATE = '2026-04-22T14:00:00.000Z'

function normaliseNextPath(next: string | null): string | null {
  if (!next) return null
  if (!next.startsWith('/')) return null
  if (next.startsWith('//')) return null
  if (next.startsWith('/auth/')) return null
  return next
}

function isCreatedBeforeLaunch(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const ts = Date.parse(createdAt)
  if (Number.isNaN(ts)) return false
  return ts < Date.parse(ONBOARDING_FEATURE_LAUNCH_DATE)
}

function parseJwtPayload(accessToken: string | null | undefined): Record<string, unknown> | null {
  if (!accessToken) return null

  const parts = accessToken.split('.')
  if (parts.length < 2) return null

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

function isAdminSurface(pathname: string): boolean {
  return pathname.startsWith('/api/admin/') || pathname.startsWith('/platform/admin')
}

function hasTrustedAdminSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const adminSecret = request.headers.get('x-admin-secret')

  return authHeader === `Bearer ${process.env.CRON_SECRET}`
    || adminSecret === process.env.ADMIN_SECRET
    || adminSecret === process.env.SEED_SECRET
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()

  return request.headers.get('x-real-ip')
    ?? request.headers.get('cf-connecting-ip')
    ?? 'unknown'
}

function hasAllowedRequestSource(request: NextRequest): boolean {
  const origin = request.headers.get('origin') ?? ''
  const referer = request.headers.get('referer') ?? ''
  const host = request.headers.get('host') ?? ''
  const isDev = process.env.NODE_ENV !== 'production'
  const allowed = [
    host ? `https://${host}` : '',
    ...(isDev ? ['http://localhost:3000', 'http://localhost:3001'] : []),
    process.env.NEXT_PUBLIC_APP_URL ?? '',
  ].filter(Boolean)

  const matchesAllowedSource = (value: string) =>
    allowed.some(allowedOrigin => value.startsWith(allowedOrigin))

  if (!origin && !referer) return false
  if (origin && !matchesAllowedSource(origin)) return false
  if (referer && !matchesAllowedSource(referer)) return false
  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authHeader = request.headers.get('authorization') ?? ''
  const hasWorkbenchBearerAuth =
    pathname.startsWith('/api/workbench') && authHeader.toLowerCase().startsWith('bearer ')
  const PIOS_BLOCKED = ['/api/debug', '/.env', '/.git', '/api/openapi']
  if (PIOS_BLOCKED.some(p => pathname.startsWith(p))) {
    return new NextResponse('Not found.', { status: 404 })
  }

  // Build base response and apply security headers to everything
  // CSP is set in next.config.js headers(). Middleware only adds non-CSP security headers.
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

  // ── CSRF protection (ISO 27001 A.8.26) ─────────────────────────────────────
  const method = request.method.toUpperCase()
  if (['POST','PUT','PATCH','DELETE'].includes(method) &&
      !pathname.startsWith('/api/stripe/webhook') &&
      !pathname.startsWith('/api/admin/') &&
      !pathname.startsWith('/auth/')) {
    if (!hasAllowedRequestSource(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'CSRF validation failed' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } }
      )
    }
  }

  // Rate limiting
  const ip = getClientIp(request)
  const limit = await rateLimit({
    key: `middleware:${ip}`,
    max: MIDDLEWARE_RATE_LIMIT.max,
    windowMs: MIDDLEWARE_RATE_LIMIT.windowMs,
  })
  if (!limit.success) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(MIDDLEWARE_RATE_LIMIT.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(limit.resetAt / 1000)),
          ...SEC_HEADERS,
        },
      }
    )
  }

  // Supabase session check — refresh token if needed
  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
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
  const { data: { session } } = await supabase.auth.getSession()

  // ── ISO 27001 A.9.4.2 — Session idle timeout (4 hours) ────────────────────
  // If the user's session is older than 4 hours, sign out and redirect to login.
  // The middleware refreshes the token on every request; this catches sessions
  // where the user was inactive for an extended period.
  if (user) {
    if (session) {
      const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000 // 4 hours
      const lastSignIn = user.last_sign_in_at
        ? new Date(user.last_sign_in_at).getTime()
        : 0
      const sessionCreated = session.expires_at
        ? (session.expires_at * 1000) - 3600000 // Supabase default expiry is 1hr after creation
        : lastSignIn
      const sessionAge = Date.now() - Math.max(lastSignIn, sessionCreated)

      if (sessionAge > SESSION_MAX_AGE_MS) {
        await supabase.auth.signOut()
        const expiredUrl = new URL('/auth/login', request.url)
        expiredUrl.searchParams.set('reason', 'session_expired')
        return NextResponse.redirect(expiredUrl)
      }
    }
  }

  type OnboardingProfileRow = {
    onboarded: boolean | null
    onboarding_complete?: boolean | null
    onboarding_current_step?: number | null
    created_at?: string | null
  }

  let profile: OnboardingProfileRow | null = null
  let profileReadFailed = false

  if (user) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('onboarded,onboarding_complete,onboarding_current_step,created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      profileReadFailed = true
      console.error('[middleware] failed to read onboarding profile; failing open to avoid redirect loop', {
        userId: user.id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
    } else {
      profile = data
    }
  }

  const resumeStep = typeof profile?.onboarding_current_step === 'number'
    ? Math.min(6, Math.max(1, profile.onboarding_current_step))
    : 1

  const isLegacyUser = isCreatedBeforeLaunch(user?.created_at)
    || isCreatedBeforeLaunch(profile?.created_at)

  const explicitComplete = profile?.onboarding_complete === true || profile?.onboarded === true
  const hasLegacyNullComplete = profile?.onboarding_complete == null
  const bypassOnboarding = isLegacyUser || hasLegacyNullComplete

  // IMPORTANT: only force onboarding if we positively know user is incomplete.
  const knownIncomplete = !profileReadFailed
    && !explicitComplete
    && !bypassOnboarding
    && (
      profile?.onboarding_complete === false
      || profile?.onboarded === false
      || profile === null
    )

  const isOnboarded = explicitComplete || bypassOnboarding || profileReadFailed

  // Onboarding gate — redirect only when we KNOW user is incomplete.
  if (user && pathname.startsWith('/platform/') && !pathname.startsWith('/platform/demo')) {
    if (knownIncomplete) {
      return NextResponse.redirect(new URL(`/onboarding?step=${resumeStep}`, request.url))
    }
  }

  if (user && pathname === '/onboarding') {
    const force = request.nextUrl.searchParams.get('force')
    if (isOnboarded && force !== '1') {
      return NextResponse.redirect(new URL('/platform/dashboard', request.url))
    }
  }

  if (user && isAdminSurface(pathname) && !hasTrustedAdminSecret(request)) {
    const jwtPayload = parseJwtPayload(session?.access_token)
    const aal = typeof jwtPayload?.aal === 'string' ? jwtPayload.aal : 'aal1'

    if (aal !== 'aal2') {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'MFA required for admin operations' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } }
        )
      }

      const mfaUrl = new URL('/auth/login', request.url)
      mfaUrl.searchParams.set('next', pathname)
      mfaUrl.searchParams.set('reason', 'mfa_required')
      return NextResponse.redirect(mfaUrl)
    }
  }


  // Unauthenticated — redirect or 401
  if (!user && !hasWorkbenchBearerAuth) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorised' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } }
      )
    }
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user on login/signup — respect onboarding state and intended destination.
  if (pathname === '/auth/login' || pathname === '/auth/signup') {
    const next = normaliseNextPath(request.nextUrl.searchParams.get('next'))
    const destination = !isOnboarded ? `/onboarding?step=${resumeStep}` : (next ?? '/platform/dashboard')
    return NextResponse.redirect(new URL(destination, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
