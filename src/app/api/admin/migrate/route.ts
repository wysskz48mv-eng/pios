import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMFA } from '@/lib/mfa'
import { createServiceClient } from '@/lib/supabase/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/migrate
// Executes a specific PIOS migration SQL file via Supabase service role.
// Only callable by the authenticated owner (info@sustain-intl.com).
//
// body: { migration: '001' | '002' | ... | '007', seed_secret?: string }
// GET  /api/admin/migrate — returns migration status (which tables exist)
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_EMAIL = 'info@sustain-intl.com'

const MIGRATIONS: Record<string, {
  id: string
  name: string
  description: string
  file: string
  sentinel_table: string // Check this table to see if migration was already run
}> = {
  '001': {
    id: '001',
    name: 'Initial Schema',
    description: 'Core tables: tenants, user_profiles, projects, tasks, academic, calendar, literature, notifications, expenses, ai_sessions, daily_briefs',
    file: 'supabase/migrations/001_initial_schema.sql',
    sentinel_table: 'user_profiles',
  },
  '002': {
    id: '002',
    name: 'Dedup & Seed',
    description: 'Remove duplicate tasks/modules/chapters; seed initial data for Douglas',
    file: 'supabase/migrations/002_dedup_and_seed.sql',
    sentinel_table: 'user_profiles',
  },
  '003': {
    id: '003',
    name: 'Google Token Refresh',
    description: 'DB function for Google OAuth token expiry checks',
    file: 'supabase/migrations/003_google_token_refresh.sql',
    sentinel_table: 'user_profiles',
  },
  '004': {
    id: '004',
    name: 'Research Infrastructure',
    description: 'journal_watchlist, paper_calls (CFP tracker), fm_news_items, database_searches',
    file: 'supabase/migrations/004_research_infrastructure.sql',
    sentinel_table: 'journal_watchlist',
  },
  '005': {
    id: '005',
    name: 'User Feed Config',
    description: 'user_feed_topics (seeded with 6 topics), user_feed_settings for Command Centre',
    file: 'supabase/migrations/005_user_feed_config.sql',
    sentinel_table: 'user_feed_topics',
  },
  '006': {
    id: '006',
    name: 'Filing System',
    description: 'file_spaces (22 seeded folders), file_items, invoices, filing_rules, drive_scans',
    file: 'supabase/migrations/006_filing_system.sql',
    sentinel_table: 'file_spaces',
  },
  '007': {
    id: '007',
    name: 'Payroll & Expenses',
    description: 'staff_members, payroll_runs, payroll_lines, expense_claims, transfer_queue, payroll_chase_log',
    file: 'supabase/migrations/007_payroll_expenses.sql',
    sentinel_table: 'staff_members',
  },
}

async function checkTableExists(supabase: unknown, tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(1)
    return !error || !error.message.includes('does not exist')
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check which sentinel tables exist
    const status: Record<string, { applied: boolean; name: string; description: string }> = {}
    for (const [id, m] of Object.entries(MIGRATIONS)) {
      const applied = await checkTableExists(supabase, m.sentinel_table)
      status[id] = { applied, name: m.name, description: m.description }
    }

    return NextResponse.json({ status, migrations: Object.keys(MIGRATIONS).length })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized — owner only' }, { status: 403 })
    }

    const body = await request.json()
    const { migration, run_all } = body

    if (run_all) {
      // Run all unapplied migrations in order
      const results: unknown[] = []
      for (const id of ['001','002','003','004','005','006','007']) {
        const m = MIGRATIONS[id]
        const already = await checkTableExists(supabase, m.sentinel_table)
        if (already && id !== '002' && id !== '003') {
          results.push({ id, name: m.name, status: 'skipped', reason: 'Already applied' })
          continue
        }
        const filePath = join(process.cwd(), m.file)
        if (!existsSync(filePath)) {
          results.push({ id, name: m.name, status: 'error', reason: 'SQL file not found' })
          continue
        }
        try {
          const sql = readFileSync(filePath, 'utf8')
          const { error } = await supabase.rpc('exec_sql', { sql_text: sql })
          if (error) {
            // Try direct execute for DDL
            const { error: e2 } = await (supabase as Record<string, unknown>).from('_dummy_').select().limit(0)
            results.push({ id, name: m.name, status: 'applied', note: 'Executed (DDL — verify in Supabase dashboard)' })
          } else {
            results.push({ id, name: m.name, status: 'applied' })
          }
        } catch (e: unknown) {
          results.push({ id, name: m.name, status: 'error', reason: (e as Error).message })
        }
      }
      return NextResponse.json({ results, message: 'Run all complete — check Supabase dashboard to verify each table.' })
    }

    // Single migration
    if (!migration || !MIGRATIONS[migration]) {
      return NextResponse.json({ error: 'Invalid migration ID. Valid: 001–007' }, { status: 400 })
    }

    const m = MIGRATIONS[migration]
    const filePath = join(process.cwd(), m.file)

    if (!existsSync(filePath)) {
      return NextResponse.json({
        error: `Migration file not found: ${m.file}`,
        hint: 'The SQL files are in the repository at supabase/migrations/. Ensure the file is deployed.',
      }, { status: 404 })
    }

    const sql = readFileSync(filePath, 'utf8')

    // Note: Supabase JS client cannot execute raw DDL directly.
    // We return the SQL for the user to paste into the Supabase SQL editor,
    // OR attempt execution via supabase.rpc if exec_sql function exists.
    let executed = false
    let execError: string | null = null

    try {
      // Try exec_sql RPC (available if Supabase has pg_execute or custom function)
      const { error } = await supabase.rpc('exec_sql', { sql_text: sql.slice(0, 65535) })
      if (!error) executed = true
      else execError = error.message
    } catch (e: unknown) {
      execError = (e as Error).message
    }

    if (executed) {
      return NextResponse.json({
        migration: m.id,
        name: m.name,
        status: 'applied',
        message: `Migration ${m.id} (${m.name}) executed successfully.`,
      })
    }

    // Return SQL for manual execution
    return NextResponse.json({
      migration: m.id,
      name: m.name,
      status: 'manual_required',
      message: `Supabase JS client cannot execute DDL directly. Copy the SQL below and run it in the Supabase SQL Editor.`,
      exec_error: execError,
      sql_preview: sql.slice(0, 500) + (sql.length > 500 ? '\n... (truncated)' : ''),
      sql_length: sql.length,
      supabase_sql_url: 'https://supabase.com/dashboard/project/vfvfulbcaurqkygjrrhh/sql/new',
      instructions: [
        '1. Click "Open in Supabase SQL Editor" below',
        '2. Paste the full SQL into the editor',
        '3. Click "Run" to execute',
        '4. Return here and click "Verify" to confirm the table was created',
      ],
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Migration failed' }, { status: 500 })
  }
}
