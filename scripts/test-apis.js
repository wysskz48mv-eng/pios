/* eslint-disable no-console */
/**
 * Workbench API smoke tests.
 *
 * Modes:
 * - Unauthenticated (default): expects 401 on protected routes.
 * - Authenticated (optional): set WORKBENCH_AUTH_COOKIE or WORKBENCH_AUTH_COOKIE_FILE,
 *   then it will attempt create -> read -> step write flow.
 */

const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

function getAuthCookie() {
  const direct = process.env.WORKBENCH_AUTH_COOKIE || ''
  if (direct.trim()) return direct.trim()

  const cookieFile = process.env.WORKBENCH_AUTH_COOKIE_FILE || ''
  if (!cookieFile.trim()) return ''

  try {
    const full = path.isAbsolute(cookieFile) ? cookieFile : path.join(process.cwd(), cookieFile)
    return fs.readFileSync(full, 'utf8').trim()
  } catch {
    return ''
  }
}

const AUTH_COOKIE = getAuthCookie()

async function ensureServerReachable() {
  try {
    const res = await fetch(`${BASE_URL}/`, { method: 'GET' })
    if (!res.ok && res.status >= 500) {
      throw new Error(`Server returned ${res.status}`)
    }
  } catch (error) {
    throw new Error(
      `Cannot reach app at ${BASE_URL}. Start the app with "npm run dev" (or set BASE_URL).`
    )
  }
}

async function http(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (AUTH_COOKIE) headers.Cookie = AUTH_COOKIE

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
    const res = await http('GET', path)
    console.log(`  GET ${path} -> ${res.status}`)
    ok(res.status === 401 || (path === '/api/workbench' && res.status === 200), `Unexpected status for ${path}: ${res.status}`)
  }

  console.log('[workbench] Unauthenticated suite passed.')
}

async function runAuthenticatedSuite() {
  console.log('\n[workbench] Running authenticated smoke suite...')

  const create = await http('POST', '/api/workbench/projects', {
    project_name: `Smoke Test ${new Date().toISOString()}`,
    client_name: 'Internal QA',
  })
  console.log(`  POST /api/workbench/projects -> ${create.status}`)
  ok(create.status === 201, `Project creation failed: ${create.status} ${JSON.stringify(create.json)}`)

  const projectId = create.json?.project?.id
  ok(Boolean(projectId), 'Project ID missing from create response')

  const detail = await http('GET', `/api/workbench/projects/${projectId}`)
  console.log(`  GET /api/workbench/projects/${projectId} -> ${detail.status}`)
  ok(detail.status === 200, `Project detail failed: ${detail.status}`)

  const step1 = await http('POST', `/api/workbench/${projectId}/1`, {
    action: 'validate_definition',
    data: {
      smart_question: 'How can we improve conversion from 2% to 3% by Q4 2026?',
      stakeholders: [{ name: 'CEO', role: 'sponsor' }],
      constraints: [{ constraint: 'budget', severity: 'medium' }],
    },
  })
  console.log(`  POST /api/workbench/${projectId}/1 -> ${step1.status}`)
  ok(step1.status === 200, `Step validation failed: ${step1.status} ${JSON.stringify(step1.json)}`)

  const archive = await http('DELETE', `/api/workbench/projects/${projectId}`)
  console.log(`  DELETE /api/workbench/projects/${projectId} -> ${archive.status}`)
  ok(archive.status === 200, `Archive failed: ${archive.status}`)

  console.log('[workbench] Authenticated suite passed.')
}

async function main() {
  console.log(`[workbench] BASE_URL=${BASE_URL}`)
  await ensureServerReachable()

  await runUnauthenticatedSuite()

  if (!AUTH_COOKIE) {
    console.log('\n[workbench] Skipping authenticated suite: set WORKBENCH_AUTH_COOKIE or WORKBENCH_AUTH_COOKIE_FILE to enable it.')
    return
  }

  await runAuthenticatedSuite()
}

main().catch((err) => {
  console.error('\n[workbench] Smoke test failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
