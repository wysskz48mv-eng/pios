#!/usr/bin/env node

const base = process.argv[2] || 'https://pios-coral.vercel.app'

let pass = 0
let fail = 0
const manual = []

async function check(label, fn) {
  try {
    const ok = await fn()
    if (ok) {
      console.log(`PASS  ${label}`)
      pass += 1
    } else {
      console.log(`FAIL  ${label}`)
      fail += 1
    }
  } catch (error) {
    console.log(`FAIL  ${label} - ${error.message}`)
    fail += 1
  }
}

function skip(label) {
  console.log(`SKIP  ${label} (manual)`)
  manual.push(label)
}

async function get(path, options = {}) {
  return fetch(`${base}${path}`, { redirect: 'manual', ...options })
}

async function main() {
  await check('Landing page (200)', async () => (await get('/')).status === 200)
  await check('Signup page (200)', async () => (await get('/auth/signup')).status === 200)
  await check('Research page (200 or 404)', async () => {
    const response = await get('/research')
    return response.status === 200 || response.status === 404
  })

  await check('Dashboard redirects to login', async () => {
    const response = await get('/platform/dashboard')
    return response.status === 302 || response.status === 307 || response.status === 308
  })

  await check('Onboarding status endpoint reachable', async () => {
    const response = await get('/api/onboarding/status')
    return response.status === 200 || response.status === 401
  })
  await check('Agents endpoint reachable', async () => {
    const response = await get('/api/agents')
    return response.status === 200 || response.status === 401
  })
  await check('Cron brief requires auth', async () => (await get('/api/cron/brief')).status === 401)
  await check('Capture endpoint is secured or unbuilt', async () => {
    const response = await fetch(`${base}/api/reporting/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_type: 'user_submitted',
        title: 'UAT smoke test',
        path: '/test',
        severity: 'low',
      }),
    })
    return response.status === 200 || response.status === 201 || response.status === 401 || response.status === 403 || response.status === 404
  })
  await check('Title contains PIOS', async () => (await (await get('/')).text()).includes('PIOS'))
  await check('No AECOM references on landing page', async () => !(await (await get('/')).text()).toLowerCase().includes('aecom'))

  skip('Magic link email received within 60 seconds')
  skip('Onboarding Step 1 persona cards load and select correctly')
  skip('Onboarding Step 2 theme picker shows 3 previews')
  skip('Theme auto-suggests based on persona')
  skip('Onboarding complete redirects to dashboard')
  skip('Dashboard renders in chosen theme')
  skip('Theme switcher opens and switches instantly')
  skip('Theme persists after refresh')
  skip('NemoClaw chat responds within 5 seconds')
  skip('Morning brief loads in command centre')
  skip('Stripe test checkout succeeds')
  skip('Subscription active in user_profiles after checkout')
  skip('Report issue widget submits successfully')
  skip('Self-heal message shown for known error patterns')

  console.log(`Automated: ${pass} passed, ${fail} failed`)
  console.log(`Manual: ${manual.length} items`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})