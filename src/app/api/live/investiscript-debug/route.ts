import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSeedSecret, requireAdminRouteEnabled } from '@/lib/security/route-guards'

// GET /api/live/investiscript-debug
// Diagnostic endpoint — tests IS Supabase connectivity
// PIOS v3.0 | VeritasIQ Technologies Ltd

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Always disabled in production — diagnostic only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = requireAdminRouteEnabled('ENABLE_LIVE_DIAGNOSTIC_ROUTES')
  if (blocked) return blocked

  const authErr = requireAdminOrSeedSecret(req)
  if (authErr) return authErr

  const IS_URL = process.env.SUPABASE_IS_URL ?? ''
  const key = process.env.SUPABASE_IS_SERVICE_KEY ?? ''
  if (!key || !IS_URL) return NextResponse.json({ error: 'IS env vars not set' })

  const results: Record<string, unknown> = {}

  // Test 1: Can we reach Supabase at all?
  try {
    const ping = await fetch(`${IS_URL}/rest/v1/`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    results.ping = { status: ping.status, ok: ping.ok }
  } catch (e: any) { results.ping = { error: e.message } }

  // Test 2: List tables visible to service role
  try {
    const tables = await fetch(`${IS_URL}/rest/v1/?apikey=${key}`)
    const data = await tables.json()
    results.tables_available = data
  } catch (e: any) { results.tables_available = { error: String(e) } }

  // Test 3: Query User table (PascalCase)
  try {
    const r = await fetch(`${IS_URL}/rest/v1/User?select=id&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    results.user_table = { status: r.status, body: await r.json() }
  } catch (e: any) { results.user_table = { error: String(e) } }

  // Test 4: Query user table (lowercase fallback)
  try {
    const r = await fetch(`${IS_URL}/rest/v1/user?select=id&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    results.user_table_lower = { status: r.status, body: await r.json() }
  } catch (e: any) { results.user_table_lower = { error: String(e) } }

  return NextResponse.json(results)
}
