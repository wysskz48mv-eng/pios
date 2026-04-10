// EnvWatcher — Autonomous Environment Variable Validator
// Level 1: Monitoring & Alerting (No Auto-Fix for secrets)
// Detects missing/invalid env vars, logs to pios_diagnostics, alerts via Slack
//
// PIOS v3.7.2 | VeritasIQ Technologies Ltd

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EnvCheck {
  name: string
  required: boolean
  pattern?: RegExp
}

// Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected
// by Supabase Edge Functions — we don't need to check them.
// NEXT_PUBLIC_* vars are NOT available in edge functions.
// We check vars that must be explicitly set as Supabase secrets.
const REQUIRED_VARS: EnvCheck[] = [
  { name: 'ANTHROPIC_API_KEY',                    required: true,  pattern: /^sk-ant-/ },
  { name: 'CRON_SECRET',                          required: true },
  { name: 'GOOGLE_CLIENT_ID',                     required: false },
  { name: 'GOOGLE_CLIENT_SECRET',                 required: false },
  { name: 'RESEND_API_KEY',                       required: false, pattern: /^re_/ },
  { name: 'SLACK_WEBHOOK_URL',                    required: false, pattern: /^https:\/\// },
]

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const runId = crypto.randomUUID()
  const missingVars: string[] = []
  const invalidVars: string[] = []

  for (const envVar of REQUIRED_VARS) {
    const value = Deno.env.get(envVar.name)

    if (!value || value.trim().length === 0) {
      missingVars.push(envVar.name)
    } else if (envVar.pattern && !envVar.pattern.test(value)) {
      invalidVars.push(envVar.name)
    }
  }

  // Log each finding to diagnostics
  for (const name of missingVars) {
    const check = REQUIRED_VARS.find(v => v.name === name)!
    await upsertFinding(supabase, runId, {
      check_type: 'env_validation',
      check_name: `env_${name.toLowerCase()}`,
      severity: check.required ? 'critical' : 'medium',
      title: `${check.required ? 'Required' : 'Optional'} env var ${name} is MISSING`,
      detail: `Set this in Supabase Edge Function secrets or Vercel environment variables.`,
      evidence: { key: name, required: check.required, status: 'missing' },
    })
  }

  for (const name of invalidVars) {
    await upsertFinding(supabase, runId, {
      check_type: 'env_validation',
      check_name: `env_${name.toLowerCase()}_invalid`,
      severity: 'high',
      title: `Env var ${name} is set but has invalid format`,
      detail: `Value doesn't match expected pattern. May be a placeholder or corrupted.`,
      evidence: { key: name, status: 'invalid_format' },
    })
  }

  // Validate Anthropic key actually works
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (anthropicKey && !missingVars.includes('ANTHROPIC_API_KEY')) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Reply OK' }],
        }),
      })
      if (!res.ok) {
        await upsertFinding(supabase, runId, {
          check_type: 'env_validation',
          check_name: 'anthropic_key_rejected',
          severity: 'critical',
          title: 'ANTHROPIC_API_KEY is set but rejected by Anthropic API',
          detail: `Status ${res.status}. Key may be revoked, expired, or over quota.`,
          evidence: { status: res.status },
        })
        invalidVars.push('ANTHROPIC_API_KEY (rejected)')
      }
    } catch {}
  }

  // Send Slack alert if issues found
  if (missingVars.length > 0 || invalidVars.length > 0) {
    await notifySlack({
      title: 'Critical: Environment Variable Issues',
      missing: missingVars,
      invalid: invalidVars,
      action: 'MANUAL_FIX_REQUIRED — secrets require human approval',
    })
  }

  // Log run
  await logRun(supabase, runId, REQUIRED_VARS.length + 1,
    missingVars.length + invalidVars.length,
    missingVars.filter(n => REQUIRED_VARS.find(v => v.name === n)?.required).length)

  const hasIssues = missingVars.length > 0 || invalidVars.length > 0

  return new Response(JSON.stringify({
    status: hasIssues ? 'CRITICAL_ISSUE_DETECTED' : 'OK',
    agent: 'env-watcher',
    message: hasIssues
      ? `${missingVars.length} missing, ${invalidVars.length} invalid`
      : 'All environment variables present and valid',
    missingVars: missingVars.length > 0 ? missingVars : undefined,
    invalidVars: invalidVars.length > 0 ? invalidVars : undefined,
    timestamp: new Date().toISOString(),
  }), {
    status: hasIssues ? 400 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Helpers ─────────────────────────────────────────────────────────────────

async function upsertFinding(supabase: any, runId: string, finding: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from('pios_diagnostics')
    .select('id, recurrence_count')
    .eq('check_name', finding.check_name)
    .in('status', ['open', 'recurring'])
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase.from('pios_diagnostics').update({
      recurrence_count: (existing.recurrence_count ?? 1) + 1,
      last_seen_at: new Date().toISOString(),
      status: 'recurring',
      run_id: runId,
    }).eq('id', existing.id)
  } else {
    await supabase.from('pios_diagnostics').insert({ run_id: runId, ...finding })
  }
}

async function logRun(supabase: any, runId: string, checks: number, findings: number, critical: number) {
  await supabase.from('pios_diagnostic_runs').insert({
    id: runId,
    trigger: 'edge_function',
    completed_at: new Date().toISOString(),
    total_checks: checks,
    findings,
    critical,
    high: 0,
    auto_fixed: 0,
    status: 'completed',
  })
}

async function notifySlack(message: Record<string, unknown>) {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhookUrl) {
    console.log('[EnvWatcher] No SLACK_WEBHOOK_URL — alert logged only:', JSON.stringify(message))
    return
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *PIOS EnvWatcher*\n${message.title}\nMissing: ${(message.missing as string[])?.join(', ') || 'none'}\nInvalid: ${(message.invalid as string[])?.join(', ') || 'none'}\nAction: ${message.action}`,
      }),
    })
  } catch (err) {
    console.error('[EnvWatcher] Slack notification failed:', err)
  }
}
