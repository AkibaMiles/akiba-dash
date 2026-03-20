import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { QUEST_IDS } from '@/lib/constants'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

/** ISO 8601 week key, e.g. "2025-W03" */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Shift to the nearest Thursday (ISO week belongs to Thursday's year)
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function pct(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = req.nextUrl

  const today = new Date().toISOString().split('T')[0]
  const to = searchParams.get('to') || today
  const from = searchParams.get('from') || daysAgo(30)

  const fromDate = new Date(from)
  const toDate = new Date(to)
  const rangeMs = toDate.getTime() - fromDate.getTime()
  const prevFrom = new Date(fromDate.getTime() - rangeMs).toISOString().split('T')[0]
  const prevTo = from
  const sevenDaysAgo = daysAgo(7)
  const prevSevenDaysStart = daysAgo(14)

  const [
    // Use passport_ops (type=burn, status=completed) for accurate pass holder count
    passOpsAllRes,
    passOpsPrevRes,
    totalWalletsRes,
    prevTotalWalletsRes,
    questClaimsCurrentRes,
    questClaimsPrevRes,
    activeNowRes,
    activePrevRes,
    balanceStreakRes,
    passAdoptionRes,
    dailyActiveRes,
    questBreakdownRes,
    partnerBreakdownRes,
  ] = await Promise.all([
    supabase.from('passport_ops').select('address').eq('type', 'burn').eq('status', 'completed').limit(500000),
    supabase.from('passport_ops').select('address').eq('type', 'burn').eq('status', 'completed').lte('created_at', prevTo + 'T23:59:59Z').limit(500000),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).lte('created_at', prevTo + 'T23:59:59Z'),
    supabase.from('daily_engagements').select('*', { count: 'exact', head: true }).gte('claimed_at', from).lte('claimed_at', to),
    supabase.from('daily_engagements').select('*', { count: 'exact', head: true }).gte('claimed_at', prevFrom).lte('claimed_at', prevTo),
    supabase.from('daily_engagements').select('user_address').gte('claimed_at', sevenDaysAgo).lte('claimed_at', today).limit(500000),
    supabase.from('daily_engagements').select('user_address').gte('claimed_at', prevSevenDaysStart).lte('claimed_at', sevenDaysAgo).limit(500000),
    supabase.from('streaks').select('user_address').eq('quest_id', QUEST_IDS.BALANCE_STREAK_10).gt('current_streak', 0).limit(500000),
    supabase.from('passport_ops').select('created_at').eq('type', 'burn').eq('status', 'completed').order('created_at').limit(500000),
    supabase.from('daily_engagements').select('claimed_at, user_address').gte('claimed_at', from).lte('claimed_at', to).limit(500000),
    supabase.from('daily_engagements').select('quest_id').gte('claimed_at', from).lte('claimed_at', to).limit(500000),
    supabase.from('partner_engagements').select('partner_quest_id').gte('claimed_at', from).lte('claimed_at', to).limit(500000),
  ])

  // Accurate pass holder counts via distinct addresses in passport_ops
  const passHolders = new Set((passOpsAllRes.data ?? []).map(r => r.address as string)).size
  const prevPassHolders = new Set((passOpsPrevRes.data ?? []).map(r => r.address as string)).size

  const totalWallets = totalWalletsRes.count ?? 0
  const prevTotalWallets = prevTotalWalletsRes.count ?? 0
  const questClaims = questClaimsCurrentRes.count ?? 0
  const prevQuestClaims = questClaimsPrevRes.count ?? 0
  const activeWallets7d = new Set((activeNowRes.data ?? []).map(r => r.user_address as string)).size
  const prevActiveWallets = new Set((activePrevRes.data ?? []).map(r => r.user_address as string)).size
  const balanceStreakWallets = new Set((balanceStreakRes.data ?? []).map(r => r.user_address as string)).size

  // Pass adoption cumulative line chart (all-time, not filtered by date range)
  const byDate: Record<string, number> = {}
  for (const op of passAdoptionRes.data ?? []) {
    const d = (op.created_at as string).split('T')[0]
    byDate[d] = (byDate[d] ?? 0) + 1
  }
  let cumulative = 0
  const passAdoption = Object.keys(byDate).sort().map(date => {
    cumulative += byDate[date]
    return { date, cumulative }
  })

  // Weekly active wallets bar chart (within selected range, grouped by ISO week)
  const weekMap: Record<string, Set<string>> = {}
  for (const row of dailyActiveRes.data ?? []) {
    const wk = isoWeek(row.claimed_at as string)
    if (!weekMap[wk]) weekMap[wk] = new Set()
    weekMap[wk].add(row.user_address as string)
  }
  const weeklyActive = Object.keys(weekMap).sort().map(week => ({
    week,
    count: weekMap[week].size,
  }))

  // Quest breakdown horizontal bar (within selected range, both engagement sources)
  // NOTE: daily_engagements uses quest_id; partner_engagements uses partner_quest_id
  const questCounts: Record<string, number> = {}
  for (const row of (questBreakdownRes.data ?? [])) {
    const qid = row.quest_id as string
    questCounts[qid] = (questCounts[qid] ?? 0) + 1
  }
  for (const row of (partnerBreakdownRes.data ?? [])) {
    const qid = row.partner_quest_id as string
    questCounts[qid] = (questCounts[qid] ?? 0) + 1
  }
  const questIds = Object.keys(questCounts)
  const questTitles: Record<string, string> = {}
  if (questIds.length > 0) {
    const { data: quests } = await supabase.from('quests').select('id, title').in('id', questIds)
    for (const q of quests ?? []) questTitles[q.id] = q.title
  }
  const questBreakdown = Object.entries(questCounts)
    .map(([questId, count]) => ({ questId, title: questTitles[questId] || 'Unknown Quest', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    kpis: {
      passHolders,
      totalWallets,
      conversionRate: totalWallets > 0 ? (passHolders / totalWallets) * 100 : 0,
      questClaims,
      activeWallets7d,
      balanceStreakWallets,
      changes: {
        passHolders: pct(passHolders, prevPassHolders),
        totalWallets: pct(totalWallets, prevTotalWallets),
        questClaims: pct(questClaims, prevQuestClaims),
        activeWallets7d: pct(activeWallets7d, prevActiveWallets),
      },
    },
    passAdoption,
    weeklyActive,
    questBreakdown,
  })
}
