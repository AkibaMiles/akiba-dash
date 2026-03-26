/**
 * Reads pre-computed engagement archive totals from data/archive/totals.json.
 * Returns zeros if the file doesn't exist yet (no archive run yet).
 *
 * Use archivedCountsInRange(table, from, to) to add historical counts to
 * live Supabase count queries for date ranges that predate the cutoff.
 */

import fs from 'fs'
import path from 'path'

type TableTotals = {
  archivedTotal: number
  cutoffDate: string
  dailyCounts: Record<string, number>      // 'YYYY-MM-DD' → count
  questCounts: Record<string, number>      // quest_id → count
  userTotalClaims: Record<string, number>  // user_address → count
}

type ArchiveTotals = Record<string, TableTotals>

let _cache: ArchiveTotals | null = null

function load(): ArchiveTotals {
  if (_cache) return _cache
  const filePath = path.join(process.cwd(), 'data', 'archive', 'totals.json')
  if (!fs.existsSync(filePath)) {
    _cache = {}
    return _cache
  }
  try {
    _cache = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ArchiveTotals
  } catch {
    _cache = {}
  }
  return _cache
}

/**
 * Returns the count of archived rows for `table` that fall within [from, to].
 * Pass null for from/to to get the full archived total.
 */
export function archivedCountsInRange(
  table: 'daily_engagements' | 'partner_engagements',
  from: string | null,
  to: string | null,
): number {
  const totals = load()
  const t = totals[table]
  if (!t) return 0

  // If the query range is entirely after the cutoff, no archived rows apply
  if (from && from >= t.cutoffDate) return 0

  // If no date filter requested, return full archived total
  if (!from && !to) return t.archivedTotal

  let count = 0
  for (const [date, n] of Object.entries(t.dailyCounts)) {
    if (from && date < from) continue
    if (to   && date > to)   continue
    count += n
  }
  return count
}

/**
 * Returns how many archived quest claims a given user_address has.
 * Used to supplement the live daily_engagements lookup on pass-holders page.
 */
export function archivedClaimsForUsers(
  addresses: string[],
): Record<string, number> {
  const totals = load()
  const t = totals['daily_engagements']
  if (!t) return {}
  const out: Record<string, number> = {}
  for (const addr of addresses) {
    const n = t.userTotalClaims[addr]
    if (n) out[addr] = n
  }
  return out
}
