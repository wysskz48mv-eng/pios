/* eslint-disable no-console */
/**
 * Workbench API smoke tests.
 *
 * Modes:
 * - Unauthenticated (default): expects 401 on protected routes.
 * - Authenticated (optional): provide one of:
 *   - WORKBENCH_AUTH_COOKIE / WORKBENCH_AUTH_COOKIE_FILE
 *   - WORKBENCH_AUTH_BEARER / WORKBENCH_AUTH_BEARER_FILE
 *   - WORKBENCH_AUTH_EMAIL + WORKBENCH_AUTH_PASSWORD (token exchange)
 *   then it will attempt create -> read -> step write flow.
 */

const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const SKIP_PREFLIGHT = process.env.WORKBENCH_SKIP_PREFLIGHT === '1'

function loadEnvFiles() {
  const files = ['.env.local', '.env']

  for (const rel of files) {
    const full = path.join(process.cwd(), rel)
    if (!fs.existsSync(full)) continue

    const raw = fs.readFileSync(full, 'utf8')
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
      const eq = normalized.indexOf('=')
      if (eq <= 0) continue

      const key = normalized.slice(0, eq).trim()
      if (!key || process.env[key]) continue

      let value = normalized.slice(eq + 1).trim()
      const quote = value[0]
      if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}

loadEnvFiles()

function readOptionalFile(filePath) {
  if (!filePath || !filePath.trim()) return ''

  try {
    const full = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
    return fs.readFileSync(full, 'utf8').trim()
  } catch {
    return ''
  }
}

function getAuthCookie() {
  const direct = process.env.WORKBENCH_AUTH_COOKIE || ''
  if (direct.trim()) return direct.trim()
  return readOptionalFile(process.env.WORKBENCH_AUTH_COOKIE_FILE || '')
}

function getAuthBearer() {
  const direct = process.env.WORKBENCH_AUTH_BEARER || ''
  if (direct.trim()) return direct.trim()
  return readOptionalFile(process.env.WORKBENCH_AUTH_BEARER_FILE || '')
}

async function exchangePasswordForBearer() {
  const email = (process.env.WORKBENCH_AUTH_EMAIL || '').trim()
  const password = process.env.WORKBENCH_AUTH_PASSWORD || ''
  if (!email || !password) return ''

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
  if (!supabaseUrl || !anonKey) return ''

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error_description || body?.msg || body?.error || ''
    } catch {}
    throw new Error(`Password auth exchange failed (${res.status})${detail ? `: ${detail}` : ''}`)
  }

  const payload = await res.json()
  return String(payload?.access_token || '').trim()
}

async function resolveAuth() {
  const cookie = getAuthCookie()
  if (cookie) return { cookie, bearer: '', source: 'cookie' }

  const bearer = getAuthBearer()
  if (bearer) return { cookie: '', bearer, source: 'bearer' }

  const passwordBearer = await exchangePasswordForBearer()
  if (passwordBearer) return { cookie: '', bearer: passwordBearer, source: 'password' }

  return { cookie: '', bearer: '', source: 'none' }
}

async function ensureServerReachable() {
  try {
    const res = await fetch(`${BASE_URL}/`, { method: 'GET' })
    if (!res.ok && res.status >= 500) {
      throw new Error(`Server returned ${res.status}`)
    }
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : ''
    throw new Error(
      `Cannot reach app at ${BASE_URL}${detail}. Start the app with "npm run dev" (or set BASE_URL). ` +
      'If this is a restricted network/CI environment, set WORKBENCH_SKIP_PREFLIGHT=1.'
    )
  }
}

async function http(method, path, body, auth, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (useAuth) {
    if (auth.cookie) headers.Cookie = auth.cookie
    if (auth.bearer) headers.Authorization = `Bearer ${auth.bearer}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  return { status: res.status, json }
}

function ok(condition, message) {
  if (!condition) throw new Error(message)
}

async function runUnauthenticatedSuite() {
  console.log('\n[workbench] Running unauthenticated smoke suite...')

  const endpoints = [
    '/api/workbench',
    '/api/workbench/projects',
    '/api/workbench/projects/test-project-id',
    '/api/workbench/test-project-id/1',
  ]

  for (const path of endpoints) {
    const res = await http('GET', path, undefined, { cookie: '', bearer: '' }, false)
    console.log(`  GET ${path} -> ${res.status}`)
    ok(res.status === 401 || (path === '/api/workbench' && res.status === 200), `Unexpected status for ${path}: ${res.status}`)
  }

  console.log('[workbench] Unauthenticated suite passed.')
}

async function runAuthenticatedSuite(auth) {
  console.log('\n[workbench] Running authenticated smoke suite...')

  const create = await http('POST', '/api/workbench/projects', {
    project_name: `Smoke Test ${new Date().toISOString()}`,
    client_name: 'Internal QA',
  }, auth)
  console.log(`  POST /api/workbench/projects -> ${create.status}`)
  ok(create.status === 201, `Project creation failed: ${create.status} ${JSON.stringify(create.json)}`)

  const projectId = create.json?.project?.id
  ok(Boolean(projectId), 'Project ID missing from create response')

  const detail = await http('GET', `/api/workbench/projects/${projectId}`, undefined, auth)
  console.log(`  GET /api/workbench/projects/${projectId} -> ${detail.status}`)
  ok(detail.status === 200, `Project detail failed: ${detail.status}`)

  const step1 = await http('POST', `/api/workbench/${projectId}/1`, {
    action: 'validate_definition',
    data: {
      smart_question: 'How can we improve conversion from 2% to 3% by Q4 2026?',
      stakeholders: [{ name: 'CEO', role: 'sponsor' }],
      constraints: [{ constraint: 'budget', severity: 'medium' }],
    },
  }, auth)
  console.log(`  POST /api/workbench/${projectId}/1 -> ${step1.status}`)
  ok(step1.status === 200, `Step validation failed: ${step1.status} ${JSON.stringify(step1.json)}`)

  const archive = await http('DELETE', `/api/workbench/projects/${projectId}`, undefined, auth)
  console.log(`  DELETE /api/workbench/projects/${projectId} -> ${archive.status}`)
  ok(archive.status === 200, `Archive failed: ${archive.status}`)

  console.log('[workbench] Authenticated suite passed.')
}

async function main() {
  console.log(`[workbench] BASE_URL=${BASE_URL}`)
  if (!SKIP_PREFLIGHT) {
    await ensureServerReachable()
  } else {
    console.log('[workbench] Skipping reachability preflight (WORKBENCH_SKIP_PREFLIGHT=1).')
  }

  await runUnauthenticatedSuite()

  const auth = await resolveAuth()
  if (auth.source !== 'none') {
    console.log(`[workbench] Auth mode: ${auth.source}`)
  }

  if (!auth.cookie && !auth.bearer) {
    console.log(
      '\n[workbench] Skipping authenticated suite: set cookie, bearer token, or WORKBENCH_AUTH_EMAIL/WORKBENCH_AUTH_PASSWORD.'
    )
    return
  }

  await runAuthenticatedSuite(auth)
}

main().catch((err) => {
  console.error('\n[workbench] Smoke test failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
