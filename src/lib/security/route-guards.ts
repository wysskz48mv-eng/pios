import { NextRequest, NextResponse } from 'next/server'

export const OWNER_EMAIL = 'info@veritasiq.io'

export function requireAdminRouteEnabled(routeKey: string): NextResponse | null {
  const globalEnabled = process.env.ENABLE_ADMIN_ROUTES === 'true'
  const routeEnabled = process.env[routeKey] === 'true'

  if (process.env.NODE_ENV === 'production' && !globalEnabled && !routeEnabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return null
}

export function hasAdminOrSeedSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  const adminHeader = request.headers.get('x-admin-secret')?.trim()
  const seedHeader = request.headers.get('x-seed-secret')?.trim()

  const expected = [process.env.ADMIN_SECRET, process.env.SEED_SECRET]
    .filter(Boolean)
    .map((v) => String(v))

  if (expected.length === 0) return false

  return [authHeader, adminHeader, seedHeader]
    .filter(Boolean)
    .some((provided) => expected.includes(String(provided)))
}

export function requireAdminOrSeedSecret(request: NextRequest): NextResponse | null {
  if (hasAdminOrSeedSecret(request)) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function hasCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  const bearer = authHeader?.replace(/^Bearer\s+/i, '').trim()
  const cronHeader = request.headers.get('x-cron-secret')?.trim()
  const expected = process.env.CRON_SECRET?.trim()

  if (!expected) return false

  return bearer === expected || cronHeader === expected
}

export function requireCronSecret(request: NextRequest): NextResponse | null {
  if (hasCronSecret(request)) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === OWNER_EMAIL
}

export function requireOwnerEmail(email: string | null | undefined): NextResponse | null {
  if (isOwnerEmail(email)) return null
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
