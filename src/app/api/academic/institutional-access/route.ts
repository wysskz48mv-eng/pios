import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET — return current user's institutional access record ─────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return cached record if exists
  const { data: existing } = await supabase
    .from('user_institutional_access')
    .select('*, institution:institutional_scopus_config(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ access: existing })

  // Auto-detect from email domain and upsert
  const access = await detectAndUpsert(user.id, user.email ?? '', supabase)
  return NextResponse.json({ access })
}

// ─── POST — force re-detection (called after login or email change) ──────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const email = (body.email as string | undefined) ?? user.email ?? ''

  const access = await detectAndUpsert(user.id, email, supabase)

  // Log if Scopus access was confirmed
  if (access?.scopus_access && body.log_search) {
    await supabase.from('scopus_search_log').insert({
      user_id:       user.id,
      institution_id: access.institution_id,
      query:         body.query ?? '',
      results_count: 0,
      method:        'detect',
    })
  }

  return NextResponse.json({ access })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function detectAndUpsert(userId: string, email: string, supabase: SupabaseClient) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (!domain) return null

  // Look up institution by domain
  const { data: inst } = await supabase
    .from('institutional_scopus_config')
    .select('*')
    .eq('institution_domain', domain)
    .eq('active', true)
    .maybeSingle()

  const payload = {
    user_id:            userId,
    email_domain:       domain,
    institution_id:     inst?.id ?? null,
    institution_name:   inst?.display_name ?? null,
    institution_domain: inst?.institution_domain ?? null,
    scopus_access:      inst != null,
    api_access_enabled: inst?.api_enabled ?? false,
    web_access_url:     inst?.scopus_web_url ?? null,
    last_verified:      new Date().toISOString(),
    verification_method: 'email_domain',
  }

  const { data, error } = await supabase
    .from('user_institutional_access')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*, institution:institutional_scopus_config(*)')
    .single()

  if (error) return payload  // return plain payload on write error
  return data
}
