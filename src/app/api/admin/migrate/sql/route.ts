import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminRouteEnabled, requireOwnerEmail } from '@/lib/security/route-guards'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

const FILES: Record<string, string> = {
  '001': 'supabase/migrations/001_initial_schema.sql',
  '002': 'supabase/migrations/002_dedup_and_seed.sql',
  '003': 'supabase/migrations/003_google_token_refresh.sql',
  '004': 'supabase/migrations/004_research_infrastructure.sql',
  '005': 'supabase/migrations/005_user_feed_config.sql',
  '006': 'supabase/migrations/006_filing_system.sql',
  '007': 'supabase/migrations/007_payroll_expenses.sql',
  '008': 'supabase/migrations/008_thesis_weekly_snapshots.sql',
  '009': 'supabase/migrations/009_multi_email_meeting_notes.sql',
  '010': 'supabase/migrations/010_dba_milestones.sql',
  '011': 'supabase/migrations/011_learning_journeys.sql',
}

export async function GET(request: Request) {
  try {
    const blocked = requireAdminRouteEnabled('ENABLE_ADMIN_MIGRATION_ROUTES')
    if (blocked) return blocked

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ownerErr = requireOwnerEmail(user.email)
    if (ownerErr) return ownerErr

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id || !FILES[id]) return NextResponse.json({ error: 'Invalid migration ID' }, { status: 400 })
    const filePath = join(process.cwd(), FILES[id])
    if (!existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const sql = readFileSync(filePath, 'utf8')
    return NextResponse.json({ id, sql, length: sql.length })
  } catch (err: unknown) {
    return apiError(err)
  }
}
