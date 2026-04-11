/**
 * GET /api/cron/diagnostics
 * Deep diagnostic engine — probes the entire PIOS stack for latent issues.
 *
 * Unlike health checks (is it alive?), diagnostics asks:
 *   - Can the user actually see their data? (RLS validation)
 *   - Do the tables the code expects actually exist? (schema validation)
 *   - Do API endpoints return the shape the frontend expects? (contract validation)
 *   - Are there data integrity issues? (orphaned records, stale state)
 *   - What patterns keep recurring? (learning from past findings)
 *
 * Findings are stored in pios_diagnostics with severity, recurrence tracking,
 * and pattern matching against known issue types.
 *
 * Runs every 6 hours via Vercel cron. Can also be triggered manually.
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const maxDuration = 120

interface Finding {
  check_type: string
  check_name: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  detail: string
  affected_route?: string
  affected_table?: string
  evidence?: Record<string, unknown>
  fix_applied?: string
}

export async function GET(req: NextRequest) {
  const blocked = requireCronSecret(req)
  if (blocked) return blocked

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(url, key)
  const started = Date.now()
  const runId = crypto.randomUUID()
  const findings: Finding[] = []
  let totalChecks = 0

  // Create run record
  await supabase.from('pios_diagnostic_runs').insert({
    id: runId,
    trigger: req.headers.get('x-trigger') ?? 'cron',
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 1: Schema Validation — do tables the code expects actually exist?
  // ═══════════════════════════════════════════════════════════════════════════

  const EXPECTED_TABLES = [
    // Core
    'user_profiles', 'tasks', 'projects', 'calendar_events', 'expenses',
    'daily_briefs', 'notifications',
    // Email
    'email_items', 'email_drafts', 'connected_email_accounts',
    // Files
    'file_items', 'file_spaces', 'invoices', 'filing_rules',
    // AI
    'ai_sessions', 'user_agents', 'ai_provider_config', 'ai_provider_health_log',
    // Executive
    'exec_principles', 'exec_decisions', 'exec_reviews',
    'exec_stakeholders', 'exec_okrs', 'exec_key_results', 'exec_time_blocks',
    // Consulting
    'consulting_engagements', 'exec_decision_analyses', 'exec_time_audits',
    // Knowledge
    'knowledge_entries', 'meeting_notes',
    // Business
    'contracts', 'ip_assets', 'financial_snapshots',
    // Comms
    'sia_signal_briefs', 'bica_comms',
    // Academic
    'academic_modules', 'thesis_chapters', 'literature_items',
    // Diagnostics
    'pios_diagnostics', 'pios_diagnostic_patterns', 'pios_diagnostic_runs',
  ]

  for (const table of EXPECTED_TABLES) {
    totalChecks++
    try {
      const { error } = await supabase.from(table).select('id').limit(0)
      if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
        findings.push({
          check_type: 'schema_validation',
          check_name: `table_exists_${table}`,
          severity: 'critical',
          title: `Table "${table}" does not exist`,
          detail: `Code references this table but it is missing from the database. Run the relevant migration.`,
          affected_table: table,
          evidence: { error: error.message },
        })
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 2: RLS Validation — can the first user actually read their own data?
  // ═══════════════════════════════════════════════════════════════════════════

  // Get the first user to test with
  const { data: firstUser } = await supabase
    .from('user_profiles')
    .select('id, tenant_id, full_name')
    .order('created_at')
    .limit(1)
    .single()

  if (firstUser) {
    const RLS_TEST_TABLES = [
      'tasks', 'projects', 'expenses', 'ai_sessions',
      'exec_principles', 'exec_decisions', 'exec_okrs', 'exec_stakeholders',
      'knowledge_entries', 'contracts', 'ip_assets',
      'consulting_engagements', 'file_items', 'email_items',
    ]

    for (const table of RLS_TEST_TABLES) {
      totalChecks++
      try {
        // Service role query (bypasses RLS) — count user's rows
        const { count: serviceCount } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', firstUser.id)

        if ((serviceCount ?? 0) > 0) {
          // If service role sees data, check if tenant_id is null (potential RLS block)
          if (!firstUser.tenant_id) {
            // Check if the table has a tenant_id-based RLS policy
            const { data: policies } = await supabase.rpc('exec_sql', {
              sql_query: `SELECT polname, pg_get_expr(polqual, polrelid) as policy_expr
                          FROM pg_policy
                          WHERE polrelid = 'public.${table}'::regclass
                          AND pg_get_expr(polqual, polrelid) LIKE '%tenant_id%'`
            })

            if (policies && Array.isArray(policies) && policies.length > 0) {
              findings.push({
                check_type: 'rls_validation',
                check_name: `rls_tenant_block_${table}`,
                severity: 'critical',
                title: `RLS blocks user data on "${table}" — tenant_id policy with NULL tenant`,
                detail: `Table has ${serviceCount} rows for user ${firstUser.full_name} but RLS policy uses tenant_id. User's tenant_id is NULL, so all data is invisible.`,
                affected_table: table,
                evidence: { user_id: firstUser.id, row_count: serviceCount, policies },
              })
            }
          }
        }
      } catch {}
    }

    // Check if user has tenant_id at all
    totalChecks++
    if (!firstUser.tenant_id) {
      findings.push({
        check_type: 'data_integrity',
        check_name: 'user_missing_tenant_id',
        severity: 'medium',
        title: `User "${firstUser.full_name}" has no tenant_id`,
        detail: `Any table with tenant_id-based RLS will block this user's data. All RLS should use user_id = auth.uid() instead.`,
        evidence: { user_id: firstUser.id },
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 3: API Contract Validation — do endpoints return expected shapes?
  // ═══════════════════════════════════════════════════════════════════════════

  const API_CONTRACTS: { route: string; expected_keys: string[]; method?: string }[] = [
    { route: '/api/exec', expected_keys: ['principles', 'decisions', 'okrs', 'stakeholders', 'summary'] },
    { route: '/api/email/inbox', expected_keys: ['emails'] },
    { route: '/api/files?type=spaces', expected_keys: ['spaces'] },
    { route: '/api/files?type=items', expected_keys: ['items'] },
    { route: '/api/tasks', expected_keys: ['tasks'] },
    { route: '/api/projects', expected_keys: ['projects'] },
    { route: '/api/agents', expected_keys: ['agents'] },
    { route: '/api/billing', expected_keys: ['plan'] },
    { route: '/api/notifications', expected_keys: ['notifications'] },
    { route: '/api/academic', expected_keys: ['modules'] },
  ]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    for (const contract of API_CONTRACTS) {
      totalChecks++
      try {
        const res = await fetch(`${appUrl}${contract.route}`, {
          method: contract.method ?? 'GET',
          headers: {
            'Authorization': `Bearer ${key}`,
            'x-cron-secret': process.env.CRON_SECRET ?? '',
          },
        })

        if (res.status === 401) continue // Expected for user-scoped routes without session

        if (res.ok) {
          const data = await res.json()
          const missingKeys = contract.expected_keys.filter(k => !(k in data))
          if (missingKeys.length > 0) {
            findings.push({
              check_type: 'api_contract',
              check_name: `contract_${contract.route.replace(/[^a-z]/gi, '_')}`,
              severity: 'high',
              title: `API ${contract.route} missing expected keys: ${missingKeys.join(', ')}`,
              detail: `Frontend expects { ${contract.expected_keys.join(', ')} } but response is missing: ${missingKeys.join(', ')}. This causes empty UI.`,
              affected_route: contract.route,
              evidence: { expected: contract.expected_keys, actual_keys: Object.keys(data), status: res.status },
            })
          }
        } else if (res.status >= 500) {
          const body = await res.json().catch(() => ({}))
          findings.push({
            check_type: 'api_contract',
            check_name: `contract_${contract.route.replace(/[^a-z]/gi, '_')}`,
            severity: 'high',
            title: `API ${contract.route} returns ${res.status}`,
            detail: `Server error on ${contract.route}: ${(body as any)?.error ?? 'unknown'}`,
            affected_route: contract.route,
            evidence: { status: res.status, error: (body as any)?.error },
          })
        }
      } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 4: Token Health — are OAuth tokens functional?
  // ═══════════════════════════════════════════════════════════════════════════

  totalChecks++
  try {
    const { data: accounts } = await supabase
      .from('connected_email_accounts')
      .select('id, email_address, provider, google_token_expiry, ms_token_expiry, google_refresh_token_enc, ms_refresh_token_enc, is_active, sync_enabled')
      .eq('is_active', true)

    for (const acct of accounts ?? []) {
      totalChecks++
      const now = Date.now()

      if (acct.provider === 'google') {
        const expiry = acct.google_token_expiry ? new Date(acct.google_token_expiry).getTime() : 0
        if (expiry < now && !acct.google_refresh_token_enc) {
          findings.push({
            check_type: 'token_health',
            check_name: `token_expired_${acct.email_address}`,
            severity: 'high',
            title: `Gmail token expired for ${acct.email_address} — no refresh token`,
            detail: 'User must reconnect Gmail. Sync and send will fail until reconnected.',
            evidence: { email: acct.email_address, expiry: acct.google_token_expiry },
          })
        } else if (expiry < now && acct.google_refresh_token_enc) {
          findings.push({
            check_type: 'token_health',
            check_name: `token_refreshable_${acct.email_address}`,
            severity: 'low',
            title: `Gmail token expired for ${acct.email_address} — refresh token available`,
            detail: 'Token will auto-refresh on next sync. No action needed.',
            evidence: { email: acct.email_address, expiry: acct.google_token_expiry },
          })
        }
      }

      if (acct.provider === 'microsoft') {
        const expiry = acct.ms_token_expiry ? new Date(acct.ms_token_expiry).getTime() : 0
        if (expiry < now && !acct.ms_refresh_token_enc) {
          findings.push({
            check_type: 'token_health',
            check_name: `token_expired_${acct.email_address}`,
            severity: 'high',
            title: `Microsoft token expired for ${acct.email_address} — no refresh token`,
            detail: 'User must reconnect Microsoft account.',
            evidence: { email: acct.email_address, expiry: acct.ms_token_expiry },
          })
        }
      }
    }
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 5: Column Validation — do tables have the columns code expects?
  // ═══════════════════════════════════════════════════════════════════════════

  const COLUMN_CHECKS: { table: string; columns: string[] }[] = [
    { table: 'file_items', columns: ['size_bytes', 'source', 'ai_category', 'filing_status', 'drive_web_url'] },
    { table: 'email_items', columns: ['triage_class', 'is_meeting', 'is_flagged', 'is_snoozed', 'unsubscribe_url'] },
    { table: 'connected_email_accounts', columns: ['google_access_token_enc', 'google_refresh_token_enc'] },
    { table: 'exec_intelligence_config', columns: ['persona_context', 'tone_preference', 'response_style'] },
    { table: 'contracts', columns: ['key_terms', 'obligations', 'auto_renewal', 'extraction_source'] },
    { table: 'user_profiles', columns: ['google_access_token_enc', 'persona_type', 'onboarded'] },
  ]

  for (const check of COLUMN_CHECKS) {
    totalChecks++
    try {
      const cols = check.columns.join(',')
      const { error } = await supabase.from(check.table).select(cols).limit(0)
      if (error?.message?.includes('does not exist') || error?.message?.includes('could not find')) {
        const missingCol = error.message.match(/column.*?['"](\w+)['"]/i)?.[1] ?? 'unknown'
        findings.push({
          check_type: 'column_validation',
          check_name: `column_${check.table}_${missingCol}`,
          severity: 'critical',
          title: `Missing column "${missingCol}" on table "${check.table}"`,
          detail: `Code expects this column but it doesn't exist. This will crash any route that queries it. Run: ALTER TABLE public.${check.table} ADD COLUMN IF NOT EXISTS ${missingCol} text;`,
          affected_table: check.table,
          evidence: { error: error.message, expected_columns: check.columns },
        })
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 5b: AI Chat Smoke Test — does NemoClaw actually respond?
  // ═══════════════════════════════════════════════════════════════════════════

  totalChecks++
  if (appUrl) {
    try {
      const chatRes = await fetch(`${appUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] }),
      })
      const chatData = await chatRes.json()

      if (!chatData.reply) {
        findings.push({
          check_type: 'endpoint_smoke',
          check_name: 'ai_chat_no_reply',
          severity: 'critical',
          title: 'NemoClaw AI chat returns no reply field',
          detail: `POST /api/ai/chat returned ${JSON.stringify(Object.keys(chatData))} instead of {reply}. Status: ${chatRes.status}. Error: ${chatData.error ?? 'none'}. Users see "something went wrong".`,
          affected_route: '/api/ai/chat',
          evidence: { status: chatRes.status, keys: Object.keys(chatData), error: chatData.error },
        })
      } else if (chatData.reply.includes('unavailable') || chatData.reply.includes('authentication') || chatData.reply.includes('sign in')) {
        findings.push({
          check_type: 'endpoint_smoke',
          check_name: 'ai_chat_degraded',
          severity: 'high',
          title: `NemoClaw responds but degraded: "${chatData.reply.slice(0, 80)}"`,
          detail: chatData.reply,
          affected_route: '/api/ai/chat',
          evidence: { reply_preview: chatData.reply.slice(0, 200) },
        })
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 6: Environment Completeness
  // ═══════════════════════════════════════════════════════════════════════════

  const REQUIRED_ENV = [
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY', 'CRON_SECRET', 'JWT_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ]

  for (const envKey of REQUIRED_ENV) {
    totalChecks++
    const val = process.env[envKey]
    if (!val || val.length < 5 || val.startsWith('<') || val.startsWith('your_')) {
      findings.push({
        check_type: 'env_validation',
        check_name: `env_${envKey.toLowerCase()}`,
        severity: 'critical',
        title: `Required env var ${envKey} is missing or placeholder`,
        detail: `Set this in Vercel → Environment Variables. Current value is empty or a placeholder.`,
        evidence: { key: envKey, set: !!val, length: val?.length ?? 0 },
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 6: Data Freshness — are cron jobs actually producing output?
  // ═══════════════════════════════════════════════════════════════════════════

  totalChecks++
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('daily_briefs')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', oneDayAgo)

    if ((count ?? 0) === 0) {
      findings.push({
        check_type: 'cron_health',
        check_name: 'daily_brief_missing',
        severity: 'medium',
        title: 'No daily brief generated in last 24 hours',
        detail: 'The /api/cron/brief job may not be running. Check Vercel cron logs and CRON_SECRET.',
      })
    }
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 7: Agent Health — are enabled agents running?
  // ═══════════════════════════════════════════════════════════════════════════

  totalChecks++
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: staleAgents } = await supabase
      .from('user_agents')
      .select('agent_id, last_run_at, last_run_status, enabled')
      .eq('enabled', true)

    for (const agent of staleAgents ?? []) {
      totalChecks++
      if (!agent.last_run_at || agent.last_run_at < twoDaysAgo) {
        findings.push({
          check_type: 'agent_health',
          check_name: `stale_agent_${agent.agent_id}`,
          severity: 'medium',
          title: `Agent "${agent.agent_id}" enabled but hasn't run in 48h+`,
          detail: `Last run: ${agent.last_run_at ?? 'never'}. Status: ${agent.last_run_status ?? 'unknown'}.`,
          evidence: { agent_id: agent.agent_id, last_run: agent.last_run_at, status: agent.last_run_status },
        })
      }
      if (agent.last_run_status === 'error' || agent.last_run_status === 'failed') {
        findings.push({
          check_type: 'agent_health',
          check_name: `failed_agent_${agent.agent_id}`,
          severity: 'high',
          title: `Agent "${agent.agent_id}" last run failed`,
          detail: `Last status: ${agent.last_run_status}. Needs investigation.`,
          evidence: { agent_id: agent.agent_id, status: agent.last_run_status },
        })
      }
    }
  } catch {}

  // ═══════════════════════════════════════════════════════════════════════════
  // STORE FINDINGS — with recurrence tracking (evolutionary learning)
  // ═══════════════════════════════════════════════════════════════════════════

  for (const f of findings) {
    // Check if this exact finding was seen before
    const { data: existing } = await supabase
      .from('pios_diagnostics')
      .select('id, recurrence_count')
      .eq('check_type', f.check_type)
      .eq('check_name', f.check_name)
      .in('status', ['open', 'recurring'])
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Recurring issue — increment counter and update
      await supabase.from('pios_diagnostics').update({
        recurrence_count: (existing.recurrence_count ?? 1) + 1,
        last_seen_at: new Date().toISOString(),
        status: 'recurring',
        run_id: runId,
        severity: f.severity,
        detail: f.detail,
        evidence: f.evidence ?? {},
      }).eq('id', existing.id)
    } else {
      // New finding
      await supabase.from('pios_diagnostics').insert({
        run_id: runId,
        ...f,
        evidence: f.evidence ?? {},
      })
    }

    // Update pattern match counts
    const patternMap: Record<string, string> = {
      'rls_validation': 'rls_tenant_block',
      'schema_validation': f.check_name.startsWith('table_exists') ? 'missing_table' : 'column_name_mismatch',
      'api_contract': 'api_response_key_mismatch',
      'token_health': 'expired_oauth_token',
      'agent_health': 'stale_agent_run',
    }

    const patternName = patternMap[f.check_type]
    if (patternName) {
      await supabase.from('pios_diagnostic_patterns').update({
        last_detected: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('pattern_name', patternName)

      // Increment counter via RPC
      try {
        await supabase.rpc('exec_sql', {
          sql_query: `UPDATE pios_diagnostic_patterns SET times_detected = times_detected + 1 WHERE pattern_name = '${patternName}'`
        })
      } catch {}
    }
  }

  // Complete the run record
  const duration = Date.now() - started
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length

  await supabase.from('pios_diagnostic_runs').update({
    completed_at: new Date().toISOString(),
    duration_ms: duration,
    total_checks: totalChecks,
    findings: findings.length,
    critical: criticalCount,
    high: highCount,
    auto_fixed: 0,
    status: 'completed',
  }).eq('id', runId)

  return NextResponse.json({
    ok: true,
    run_id: runId,
    duration_ms: duration,
    total_checks: totalChecks,
    findings: findings.length,
    critical: criticalCount,
    high: highCount,
    by_type: {
      schema: findings.filter(f => f.check_type === 'schema_validation').length,
      rls: findings.filter(f => f.check_type === 'rls_validation').length,
      api: findings.filter(f => f.check_type === 'api_contract').length,
      token: findings.filter(f => f.check_type === 'token_health').length,
      env: findings.filter(f => f.check_type === 'env_validation').length,
      cron: findings.filter(f => f.check_type === 'cron_health').length,
      agent: findings.filter(f => f.check_type === 'agent_health').length,
      data: findings.filter(f => f.check_type === 'data_integrity').length,
    },
    findings_detail: findings,
  })
}
