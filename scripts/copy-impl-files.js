#!/usr/bin/env node
// Cross-platform (Windows / Mac / Linux)
// Copies ONYX UX implementation files from pios-impl/src into src/

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const IMPL = path.join(ROOT, 'pios-impl', 'src')
const SRC = path.join(ROOT, 'src')

function copyFile(relSrc, relDst) {
  const src = path.join(IMPL, relSrc)
  const dst = path.join(SRC, relDst)
  if (!fs.existsSync(src)) {
    console.error(`  SOURCE MISSING: pios-impl/src/${relSrc}`)
    console.error('  Download pios-impl/ into the repo root before running this task.')
    process.exit(1)
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
  console.log(`  Copied ${relDst.replace(/\\/g, '/')}`)
}

const files = [
  ['lib/themes.ts', 'lib/themes.ts'],
  ['app/page.tsx', 'app/page.tsx'],
  ['app/page.module.css', 'app/page.module.css'],
  ['app/auth/signup/page.tsx', 'app/auth/signup/page.tsx'],
  ['app/auth/signup/signup.module.css', 'app/auth/signup/signup.module.css'],
  ['app/onboarding/page.tsx', 'app/onboarding/page.tsx'],
  ['app/onboarding/onboarding.module.css', 'app/onboarding/onboarding.module.css'],
  ['app/platform/dashboard/page.tsx', 'app/platform/dashboard/page.tsx'],
  ['components/command-centre/CommandCentre.tsx', 'components/command-centre/CommandCentre.tsx'],
  ['components/command-centre/OnyxCC.tsx', 'components/command-centre/OnyxCC.tsx'],
  ['components/command-centre/MeridianCC.tsx', 'components/command-centre/MeridianCC.tsx'],
  ['components/command-centre/SignalCC.tsx', 'components/command-centre/SignalCC.tsx'],
  ['components/command-centre/cc.module.css', 'components/command-centre/cc.module.css'],
]

console.log('Copying implementation files...')
files.forEach(([source, destination]) => copyFile(source, destination))
console.log('Done.')