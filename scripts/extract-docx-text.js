const mammoth = require('mammoth')

async function main() {
  const p = process.argv[2]
  if (!p) {
    console.error('Usage: node scripts/extract-docx-text.js <path-to-docx>')
    process.exit(1)
  }

  const result = await mammoth.extractRawText({ path: p })
  const text = result.value || ''
  console.log(`CHARS=${text.length}`)
  console.log('HEAD_START')
  console.log(text.slice(0, 4000))
  console.log('HEAD_END')
}

main().catch((err) => {
  console.error(err.message || String(err))
  process.exit(1)
})
