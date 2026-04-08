#!/usr/bin/env node

const { execSync } = require('child_process')

const team = 'team_w1nbEmo6pfxJQ9NkYgDGxh3U'
const vars = [
  ['NEXT_PUBLIC_SUPABASE_URL', true],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', true],
  ['SUPABASE_SERVICE_ROLE_KEY', true],
  ['NEXTAUTH_SECRET', true],
  ['APP_URL', false],
  ['ANTHROPIC_API_KEY', true],
  ['CRON_SECRET', true],
  ['STRIPE_SECRET_KEY', false],
  ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', false],
  ['STRIPE_WEBHOOK_SECRET', false],
  ['RESEND_API_KEY', false],
  ['GMAIL_CLIENT_ID', false],
  ['GMAIL_CLIENT_SECRET', false],
  ['GMAIL_REDIRECT_URI', false],
]

let envList = ''
try {
  envList = execSync(`vercel env ls production --team ${team}`, { encoding: 'utf8', stdio: 'pipe' })
} catch {
  console.error('Could not list Vercel env vars. Ensure Vercel CLI is installed and logged in.')
  process.exit(1)
}

let missing = 0
let criticalMissing = 0
for (const [name, critical] of vars) {
  const found = envList.includes(name)
  if (found) {
    console.log(`SET ${name}`)
  } else {
    console.log(`MISSING ${name}${critical ? ' CRITICAL' : ''}`)
    missing += 1
    if (critical) criticalMissing += 1
  }
}

if (missing > 0) {
  console.log(`${missing} missing, ${criticalMissing} critical.`)
  process.exit(1)
}

console.log('All env vars set.')