/** ISO 8601 week key, e.g. "2025-W03" */
export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

async function duneGet(queryId: number, limit = 1000): Promise<unknown[] | null> {
  const apiKey = process.env.DUNE_API_KEY
  if (!apiKey) return null
  const res = await fetch(
    `https://api.dune.com/api/v1/query/${queryId}/results?limit=${limit}`,
    { headers: { 'X-Dune-API-Key': apiKey }, next: { revalidate: 3600 } },
  )
  if (!res.ok) return null
  const json = await res.json()
  return json?.result?.rows ?? null
}

export async function fetchDuneTotalWallets(): Promise<number> {
  const rows = await duneGet(5667458, 1) as { lifetime_users: number }[] | null
  return Number(rows?.[0]?.lifetime_users ?? 0)
}

export async function fetchDuneWeeklyActive(): Promise<{ week: string; count: number }[]> {
  const rows = await duneGet(5668123) as { timeline: string; users: number }[] | null
  if (!rows) return []
  return rows
    .map(r => ({ week: isoWeek(r.timeline.split(' ')[0]), count: Number(r.users) }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

export interface RaffleRound {
  roundid: string
  reward_token: string | null
  total_rewards_distributed: number | null
  total_spent: number | null
  participants: number | null
  raffle_start: string | null
}

export interface RaffleStats {
  totalRounds: number
  totalUSDT: number
  totalAKIBA: number
  totalPointsSpent: number
  totalParticipations: number
  usdtRounds: number
  akibaRounds: number
  usdtParticipations: number
  akibaParticipations: number
}

const EMPTY_RAFFLE_STATS: RaffleStats = {
  totalRounds: 0, totalUSDT: 0, totalAKIBA: 0,
  totalPointsSpent: 0, totalParticipations: 0,
  usdtRounds: 0, akibaRounds: 0,
  usdtParticipations: 0, akibaParticipations: 0,
}

export async function fetchDuneRaffleStats(from?: string, to?: string): Promise<RaffleStats> {
  const rows = await duneGet(5671783) as RaffleRound[] | null
  if (!rows) return EMPTY_RAFFLE_STATS
  const fromMs = from ? new Date(from).getTime() : null
  const toMs   = to   ? new Date(to + 'T23:59:59Z').getTime() : null
  const filtered = rows.filter(r => {
    if (!r.raffle_start) return true
    const t = new Date(r.raffle_start).getTime()
    if (fromMs && t < fromMs) return false
    if (toMs   && t > toMs)   return false
    return true
  })
  let totalUSDT = 0, totalAKIBA = 0, totalPointsSpent = 0, totalParticipations = 0
  let usdtRounds = 0, akibaRounds = 0, usdtParticipations = 0, akibaParticipations = 0
  for (const r of filtered) {
    const amount = Number(r.total_rewards_distributed ?? 0)
    const parts  = Number(r.participants ?? 0)
    if (r.reward_token === 'USDT') {
      totalUSDT += amount
      usdtRounds++
      usdtParticipations += parts
    } else if (r.reward_token === 'AKIBA') {
      totalAKIBA += amount
      akibaRounds++
      akibaParticipations += parts
    }
    totalPointsSpent  += Number(r.total_spent ?? 0)
    totalParticipations += parts
  }
  return {
    totalRounds: filtered.length,
    totalUSDT,
    totalAKIBA: Math.round(totalAKIBA),
    totalPointsSpent: Math.round(totalPointsSpent),
    totalParticipations,
    usdtRounds,
    akibaRounds,
    usdtParticipations,
    akibaParticipations,
  }
}

export async function fetchDuneRaffleWeekly(): Promise<{ week: string; activeUsers: number }[]> {
  const rows = await duneGet(5671559) as { timeline: string; active_users: number; token: string }[] | null
  if (!rows) return []
  const totals = new Map<string, number>()
  for (const r of rows) {
    const week = isoWeek(r.timeline.split(' ')[0])
    totals.set(week, (totals.get(week) ?? 0) + Number(r.active_users))
  }
  return Array.from(totals.entries())
    .map(([week, activeUsers]) => ({ week, activeUsers }))
    .sort((a, b) => a.week.localeCompare(b.week))
}
