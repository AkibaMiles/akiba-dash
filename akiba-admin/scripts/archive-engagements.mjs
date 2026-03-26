/**
 * archive-engagements.mjs
 *
 * Exports daily_engagements and partner_engagements rows older than CUTOFF_DAYS
 * to data/archive/{table}/YYYY-MM.json, then writes a totals.json that the
 * API routes can use to supplement live counts after the rows are deleted.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/archive-engagements.mjs
 *
 * After verifying the output files, run the printed DELETE statements in
 * the Supabase SQL editor to remove the archived rows.
 *
 * Set DRY_RUN=false to skip the DELETE confirmation prompt and delete automatically.
 */

import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Config ───────────────────────────────────────────────────────────────────
const CUTOFF_DAYS = 90
const PAGE_SIZE   = 1000
const DRY_RUN     = process.env.DRY_RUN !== 'false'   // default: dry run
const TABLES      = ['daily_engagements', 'partner_engagements']

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const cutoffDate = new Date(Date.now() - CUTOFF_DAYS * 86_400_000)
  .toISOString()
  .split('T')[0]

console.log(`Archiving rows with claimed_at < ${cutoffDate} (${CUTOFF_DAYS} days ago)\n`)

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function headers() {
  return {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'count=exact',
  }
}

async function fetchPage(table, offset) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  url.searchParams.set('select', '*')
  url.searchParams.set('claimed_at', `lt.${cutoffDate}T00:00:00Z`)
  url.searchParams.set('order', 'claimed_at.asc')
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('limit', String(PAGE_SIZE))

  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`)

  const totalStr = res.headers.get('content-range')?.split('/')[1]
  const rows = await res.json()
  return { rows, total: totalStr ? Number(totalStr) : null }
}

async function deleteOldRows(table) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  url.searchParams.set('claimed_at', `lt.${cutoffDate}T00:00:00Z`)

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
  })
  if (!res.ok) throw new Error(`${table} delete failed: ${res.status} ${await res.text()}`)
  return res.status
}

// ── Archive one table ─────────────────────────────────────────────────────────
async function archiveTable(table) {
  console.log(`\n── ${table} ──`)
  const archiveDir = path.join(ROOT, 'data', 'archive', table)
  fs.mkdirSync(archiveDir, { recursive: true })

  const byMonth = {}     // 'YYYY-MM' → rows[]
  const byDate  = {}     // 'YYYY-MM-DD' → count  (for totals.json)
  const byQuest = {}     // quest_id → count       (for totals.json)
  const byUser  = {}     // user_address → count   (for totals.json)
  let total = 0
  let offset = 0

  while (true) {
    const { rows, total: t } = await fetchPage(table, offset)
    if (t !== null && total === 0) console.log(`  Total rows to archive: ${t}`)
    if (!rows.length) break

    for (const row of rows) {
      total++
      const month = (row.claimed_at || '').slice(0, 7)   // YYYY-MM
      const date  = (row.claimed_at || '').slice(0, 10)  // YYYY-MM-DD
      const quest = row.quest_id || '__none__'
      const user  = row.user_address || '__none__'

      if (!byMonth[month]) byMonth[month] = []
      byMonth[month].push(row)

      byDate[date]  = (byDate[date]  || 0) + 1
      byQuest[quest] = (byQuest[quest] || 0) + 1
      byUser[user]  = (byUser[user]  || 0) + 1
    }

    process.stdout.write(`\r  Fetched ${total} rows…`)
    offset += PAGE_SIZE
    if (rows.length < PAGE_SIZE) break
  }

  console.log(`\r  Fetched ${total} rows — writing files…`)

  // Write per-month JSON files
  for (const [month, rows] of Object.entries(byMonth)) {
    const file = path.join(archiveDir, `${month}.json`)
    fs.writeFileSync(file, JSON.stringify(rows, null, 2))
    console.log(`  Wrote ${file} (${rows.length} rows)`)
  }

  return { total, byDate, byQuest, byUser }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const totals = {}

for (const table of TABLES) {
  const stats = await archiveTable(table)
  totals[table] = {
    archivedTotal:   stats.total,
    cutoffDate,
    dailyCounts:     stats.byDate,
    questCounts:     stats.byQuest,
    userTotalClaims: stats.byUser,
  }
}

// Write totals.json
const totalsPath = path.join(ROOT, 'data', 'archive', 'totals.json')
fs.writeFileSync(totalsPath, JSON.stringify(totals, null, 2))
console.log(`\nWrote ${totalsPath}`)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Summary ──')
for (const [table, t] of Object.entries(totals)) {
  console.log(`  ${table}: ${t.archivedTotal} rows archived (before ${cutoffDate})`)
}

// ── Delete ────────────────────────────────────────────────────────────────────
const sqlHint = TABLES.map(t =>
  `DELETE FROM ${t} WHERE claimed_at < '${cutoffDate}';`
).join('\n')

if (DRY_RUN) {
  console.log(`
── Dry run complete ──
Archive files written. To delete the rows, run in Supabase SQL editor:

${sqlHint}

Or re-run with DRY_RUN=false to delete automatically.
`)
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  rl.question(`\nDelete ${TABLES.length} tables' old rows? (yes/no): `, async (ans) => {
    rl.close()
    if (ans.trim().toLowerCase() !== 'yes') {
      console.log('Aborted — rows not deleted.')
      return
    }
    for (const table of TABLES) {
      await deleteOldRows(table)
      console.log(`Deleted rows from ${table}`)
    }
    console.log('Done.')
  })
}
