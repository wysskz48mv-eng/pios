#!/usr/bin/env node

const readline = require('readline')
const { execSync } = require('child_process')

const team = 'team_w1nbEmo6pfxJQ9NkYgDGxh3U'
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

async function setVar(name, description) {
  console.log(`\n${description}`)
  const value = await ask('Enter price_id (press Enter to skip): ')
  if (!value.trim()) {
    console.log(`Skipped ${name}`)
    return
  }
  try {
    execSync(`echo ${value.trim()} | vercel env add ${name} production --team ${team}`, {
      stdio: 'inherit',
      shell: true,
    })
  } catch {
    console.log(`Run manually: vercel env add ${name} production --team ${team}`)
    console.log(`Then paste: ${value.trim()}`)
  }
}

async function main() {
  await setVar('STRIPE_STARTER_MONTHLY_PRICE_ID', 'PIOS Starter monthly 15 GBP')
  await setVar('STRIPE_STARTER_ANNUAL_PRICE_ID', 'PIOS Starter annual 144 GBP')
  await setVar('STRIPE_PRO_MONTHLY_PRICE_ID', 'PIOS Pro monthly 35 GBP')
  await setVar('STRIPE_PRO_ANNUAL_PRICE_ID', 'PIOS Pro annual 336 GBP')
  await setVar('STRIPE_EXEC_MONTHLY_PRICE_ID', 'PIOS Executive monthly 45 GBP')
  await setVar('STRIPE_EXEC_ANNUAL_PRICE_ID', 'PIOS Executive annual 432 GBP')
  await setVar('STRIPE_CPD_STARTER_PRICE_ID', 'CPD Starter 15 GBP one-time')
  await setVar('STRIPE_CPD_STANDARD_PRICE_ID', 'CPD Standard 25 GBP one-time')
  await setVar('STRIPE_CPD_FULL_PRICE_ID', 'CPD Full 35 GBP one-time')
  rl.close()
}

main().catch((error) => {
  rl.close()
  console.error(error)
  process.exit(1)
})