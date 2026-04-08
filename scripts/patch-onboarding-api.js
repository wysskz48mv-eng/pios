#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const file = path.join(process.cwd(), 'src/app/api/onboarding/complete/route.ts')

if (!fs.existsSync(file)) {
  console.error('File not found:', file)
  process.exit(1)
}

let source = fs.readFileSync(file, 'utf8')

if (source.includes('command_centre_theme')) {
  console.log('Already patched:', file)
  process.exit(0)
}

const pattern1 = /(onboarded\s*:\s*true\s*,)/
if (pattern1.test(source)) {
  source = source.replace(
    pattern1,
    "$1\n        ...(body.command_centre_theme && { command_centre_theme: body.command_centre_theme }),"
  )
  fs.writeFileSync(file, source, 'utf8')
  console.log('Patched:', file)
  process.exit(0)
}

const pattern2 = /(\.from\('user_profiles'\)\s*\n?\s*\.update\(\{)/
if (pattern2.test(source)) {
  source = source.replace(
    pattern2,
    "$1\n        ...(body.command_centre_theme && { command_centre_theme: body.command_centre_theme }),"
  )
  fs.writeFileSync(file, source, 'utf8')
  console.log('Patched:', file)
  process.exit(0)
}

console.warn('Could not auto-patch:', file)
console.warn("Add ...(body.command_centre_theme && { command_centre_theme: body.command_centre_theme }), to the update payload.")
process.exit(1)