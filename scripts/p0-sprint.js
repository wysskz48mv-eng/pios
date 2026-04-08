#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process')
const readline = require('readline')

function run(label, command, options = {}) {
  console.log(`\n=== ${label} ===`)
  try {
    execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options,
    })
    return true
  } catch (error) {
    console.error(`FAILED: ${label}`)
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    return false
  }
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  if (!run('Copy implementation files', 'node scripts/copy-impl-files.js')) process.exit(1)
  if (!run('Patch onboarding API', 'node scripts/patch-onboarding-api.js')) process.exit(1)

  const ts = spawnSync('npx', ['tsc', '--noEmit'], { stdio: 'pipe', encoding: 'utf8', shell: true })
  if (ts.status !== 0) {
    console.error(ts.stdout || ts.stderr)
    process.exit(1)
  }
  console.log('TypeScript passed.')

  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true })
  if (build.status !== 0) {
    console.error('Build failed.')
    process.exit(1)
  }

  const confirm = await ask('Proceed with production deploy? (y/n): ')
  if (confirm.trim().toLowerCase() === 'y') {
    execSync('git add -A', { stdio: 'inherit' })
    try {
      execSync('git commit -m "feat(ux): ONYX design system + command centre theme selector + onboarding fix"', { stdio: 'inherit' })
    } catch {
      console.log('(nothing to commit)')
    }
    execSync('git push', { stdio: 'inherit' })
    execSync('vercel --prod --team team_w1nbEmo6pfxJQ9NkYgDGxh3U', { stdio: 'inherit' })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})