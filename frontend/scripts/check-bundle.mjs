// Fails when a built chunk outgrows its gzipped budget. Run after `npm run build` (npm run size).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1000
// The 3D designer loads only when opened; the main chunk is what every visitor downloads.
const BUDGETS = [
  { name: 'RoomDesigner', match: /^RoomDesigner-.*\.js$/, max: 300 * KB },
  { name: 'main', match: /^index-.*\.js$/, max: 130 * KB },
  { name: 'styles', match: /^index-.*\.css$/, max: 25 * KB },
]

const dir = join(import.meta.dirname, '..', 'dist', 'assets')
let files
try {
  files = readdirSync(dir)
} catch {
  console.error('No dist/assets folder: run `npm run build` first.')
  process.exit(1)
}

let failed = false
for (const budget of BUDGETS) {
  const matches = files.filter((f) => budget.match.test(f))
  if (!matches.length) {
    console.error(`✗ ${budget.name}: no chunk found`)
    failed = true
    continue
  }
  for (const file of matches) {
    const size = gzipSync(readFileSync(join(dir, file))).length
    const ok = size <= budget.max
    if (!ok) failed = true
    console.log(`${ok ? '✓' : '✗'} ${budget.name.padEnd(13)} ${(size / KB).toFixed(1).padStart(6)} KB gzipped (budget ${budget.max / KB} KB)  ${file}`)
  }
}
process.exit(failed ? 1 : 0)
