// AuthFlowTester — Autonomous Auth Flow Verification
// Level 3: Testing & Validation (blocks bad deploys)
// Tests app loading, login page, API health, database, OAuth token refresh
//
// PIOS v3.7.2 | VeritasIQ Technologies Ltd

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface TestResult {
  name: string
  passed: boolean
  status: string
  responseCode?: number
  responseTime?: number
  error?: string
  autoHealed?: boolean
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const runId = crypto.randomUUID()
  const baseUrl = Deno.env.get('PIOS_APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://pios-wysskz48mv-engs-projects.vercel.app'
  const tests: TestResult[] = []

  // TEST 1: App loads
  try {
    const t0 = Date.now()
    const res = await fetch(baseUrl, { redirect: 'follow' })
    const ms = Date.now() - t0
    tests.push({ name: 'App loads', passed: res.ok, status: res.ok ? 'PASS' : 'FAIL', responseCode: res.status, responseTime: ms })
  } catch (e) {
    tests.push({ name: 'App loads', passed: false, status: 'FAIL', error: (e as Error).message })
  }

  // TEST 2: Login page accessible
  try {
    const res = await fetch(`${baseUrl}/auth/login`)
    const html = await res.text()
    const hasAuth = html.includes('sign') || html.includes('login') || html.includes('auth') || html.includes('PIOS')
    tests.push({ name: 'Login page present', passed: hasAuth, status: hasAuth ? 'PASS' : 'FAIL', responseCode: res.status })
  } catch (e) {
    tests.push({ name: 'Login page present', passed: false, status: 'FAIL', error: (e as Error).message })
  }

  // TEST 3: API health
  try {
    const t0 = Date.now()
    const res = await fetch(`${baseUrl}/api/health`)
    const ms = Date.now() - t0
    tests.push({ name: 'API health', passed: res.ok, status: res.ok ? 'PASS' : 'FAIL', responseCode: res.status, responseTime: ms })
  } catch (e) {
    tests.push({ name: 'API health', passed: false, status: 'FAIL', error: (e as Error).message })
  }

  // TEST 4: Database connectivity (via Supabase direct)
  try {
    const t0 = Date.now()
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    const ms = Date.now() - t0
    tests.push({ name: 'Database connected', passed: !error, status: error ? 'FAIL' : 'PASS', responseTime: ms, error: error?.message })
  } catch (e) {
    tests.push({ name: 'Database connected', passed: false, status: 'FAIL', error: (e as Error).message })
  }

  // TEST 5: Supabase Auth service
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SERVICE_KEY } })
    const ok = res.ok
    let googleEnabled = false
    if (ok) {
      const settings = await res.json()
      googleEnabled = settings?.external?.google ?? false
    }
    tests.push({ name: 'Supabase Auth reachable', passed: ok, status: ok ? 'PASS' : 'FAIL', responseCode: res.status })
    tests.push({ name: 'Google OAuth enabled', passed: googleEnabled, status: googleEnabled ? 'PASS' : 'FAIL' })
  } catch (e) {
    tests.push({ name: 'Supabase Auth reachable', passed: false, status: 'FAIL', error: (e as Error).message })
  }

  // TEST 6: Auto-heal expired OAuth tokens
  try {
    const { data: accounts } = await supabase
      .from('connected_email_accounts')
      .select('id, email_address, google_access_token, google_refresh_token, google_token_expiry')
      .eq('is_active', true)
      .eq('provider', 'google')

    for (const acct of accounts ?? []) {
      const expiry = acct.google_token_expiry ? new Date(acct.google_token_expiry).getTime() : 0
      if (expiry < Date.now() && acct.google_refresh_token) {
        // Auto-heal: refresh the token
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
        if (clientId && clientSecret) {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: acct.google_refresh_token,
              grant_type: 'refresh_token',
            }),
          })
          const data = await res.json()
          if (data.access_token) {
            const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
            await supabase.from('connected_email_accounts').update({
              google_access_token: data.access_token,
              google_token_expiry: newExpiry,
            }).eq('id', acct.id)

            tests.push({
              name: `Token refresh: ${acct.email_address}`,
              passed: true, status: 'AUTO_HEALED', autoHealed: true,
            })

            await supabase.from('pios_diagnostics').insert({
              run_id: runId,
              check_type: 'auth_flow',
              check_name: `token_refreshed_${acct.email_address}`,
              severity: 'info',
              status: 'auto_fixed',
              title: `Auto-refreshed Google token for ${acct.email_address}`,
              detail: `New expiry: ${newExpiry}`,
              fix_applied: 'Refreshed OAuth token via Google token endpoint',
              resolved_at: new Date().toISOString(),
            })
          } else {
            tests.push({
              name: `Token refresh: ${acct.email_address}`,
              passed: false, status: 'FAIL',
              error: 'Refresh token rejected — user must reconnect',
            })
          }
        }
      }
    }
  } catch {}

  // Calculate overall
  const allPassed = tests.every(t => t.passed)
  const autoHealed = tests.filter(t => t.autoHealed).length

  // Log findings for failures
  for (const t of tests.filter(t => !t.passed && !t.autoHealed)) {
    await supabase.from('pios_diagnostics').insert({
      run_id: runId,
      check_type: 'auth_flow',
      check_name: `auth_test_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      severity: t.name.includes('Database') || t.name.includes('Auth') ? 'critical' : 'high',
      title: `Auth test failed: ${t.name}`,
      detail: t.error ?? `HTTP ${t.responseCode ?? 'unknown'}`,
      evidence: { test: t },
    })
  }

  // Log run
  await supabase.from('pios_diagnostic_runs').insert({
    id: runId,
    trigger: 'edge_function',
    completed_at: new Date().toISOString(),
    total_checks: tests.length,
    findings: tests.filter(t => !t.passed).length,
    critical: tests.filter(t => !t.passed && (t.name.includes('Database') || t.name.includes('Auth'))).length,
    high: tests.filter(t => !t.passed).length,
    auto_fixed: autoHealed,
    status: 'completed',
  })

  // Slack alert on failure
  if (!allPassed) {
    const failedTests = tests.filter(t => !t.passed && !t.autoHealed)
    await notifySlack({
      title: 'Auth Flow Test FAILED',
      failedTests: failedTests.map(t => t.name),
      autoHealed,
    })
  }

  return new Response(JSON.stringify({
    status: allPassed ? 'AUTH_TESTS_PASSED' : 'AUTH_TESTS_FAILED',
    agent: 'auth-flow-tester',
    tests,
    autoHealed,
    overallStatus: allPassed ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
  }), {
    status: allPassed ? 200 : 400,
    headers: { 'Content-Type': 'application/json' },
  })
})

async function notifySlack(message: Record<string, unknown>) {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhookUrl) {
    console.log('[AuthFlowTester] No SLACK_WEBHOOK_URL:', JSON.stringify(message))
    return
  }
  try {
    const emoji = (message.failedTests as string[])?.length ? '🚨' : '✅'
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *PIOS AuthFlowTester*\n${message.title}\nFailed: ${(message.failedTests as string[])?.join(', ') || 'none'}\nAuto-healed: ${message.autoHealed ?? 0}`,
      }),
    })
  } catch {}
}
