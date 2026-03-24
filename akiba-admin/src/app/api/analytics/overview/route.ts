import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { QUEST_IDS } from '@/lib/constants'
import {
  isoWeek,
  fetchDuneTotalWallets,
  fetchDuneWeeklyActive,
  fetchDuneRaffleStats,
  fetchDuneRaffleWeekly,
} from '@/lib/dune'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
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

  const [
    passOpsAllRes,
    passOpsPrevRes,
    totalWallets,
    questClaimsCurrentRes,
    questClaimsPrevRes,
    savers10Res,
    savers30Res,
    savers100Res,
    passAdoptionRes,
    questBreakdownRes,
    allWeeklyActive,
    raffleStats,
    allRaffleWeekly,
  ] = await Promise.all([
    supabase.from('passport_ops').select('*', { count: 'exact', head: true }).eq('type', 'burn').eq('status', 'completed'),
    supabase.from('passport_ops').select('*', { count: 'exact', head: true }).eq('type', 'burn').eq('status', 'completed').lte('created_at', prevTo + 'T23:59:59Z'),
    fetchDuneTotalWallets(),
    supabase.from('daily_engagements').select('*', { count: 'exact', head: true }).gte('claimed_at', from).lte('claimed_at', to),
    supabase.from('daily_engagements').select('*', { count: 'exact', head: true }).gte('claimed_at', prevFrom).lte('claimed_at', prevTo),
    supabase.from('streaks').select('*', { count: 'exact', head: true }).eq('quest_id', QUEST_IDS.BALANCE_STREAK_10).gt('current_streak', 0),
    supabase.from('streaks').select('*', { count: 'exact', head: true }).eq('quest_id', QUEST_IDS.BALANCE_STREAK_30).gt('current_streak', 0),
    supabase.from('streaks').select('*', { count: 'exact', head: true }).eq('quest_id', QUEST_IDS.BALANCE_STREAK_100).gt('current_streak', 0),
    supabase.from('passport_ops').select('created_at').eq('type', 'burn').eq('status', 'completed')
      .gte('created_at', from).lte('created_at', to + 'T23:59:59Z')
      .order('created_at'),
    supabase.rpc('get_quest_claim_breakdown', { from_ts: from, to_ts: to + 'T23:59:59Z' }),
    fetchDuneWeeklyActive(),
    fetchDuneRaffleStats(),
    fetchDuneRaffleWeekly(),
  ])

  const passHolders = passOpsAllRes.count ?? 0
  const prevPassHolders = passOpsPrevRes.count ?? 0
  const questClaims = questClaimsCurrentRes.count ?? 0
  const prevQuestClaims = questClaimsPrevRes.count ?? 0
  const activeWallets7d = allWeeklyActive.at(-1)?.count ?? 0
  const prevActiveWallets = allWeeklyActive.at(-2)?.count ?? 0

  // Pass adoption — daily new mints in selected period
  const byDate: Record<string, number> = {}
  for (const op of passAdoptionRes.data ?? []) {
    const d = (op.created_at as string).split('T')[0]
    byDate[d] = (byDate[d] ?? 0) + 1
  }
  const passAdoption = Object.keys(byDate).sort().map(date => ({ date, count: byDate[date] }))

  // Filter Dune weekly data to selected date range
  const fromWeek = isoWeek(from)
  const toWeek = isoWeek(to)
  const weeklyActive = allWeeklyActive.filter(w => w.week >= fromWeek && w.week <= toWeek)
  const raffleWeekly = allRaffleWeekly.filter(w => w.week >= fromWeek && w.week <= toWeek)

  // Quest breakdown — aggregated server-side via RPC
  const rpcRows = questBreakdownRes.data ?? []
  const questIds = rpcRows.map(r => r.quest_id as string)
  const questTitles: Record<string, string> = {}
  if (questIds.length > 0) {
    const [{ data: quests }, { data: partnerQuests }] = await Promise.all([
      supabase.from('quests').select('id, title').in('id', questIds),
      supabase.from('partner_quests').select('id, title').in('id', questIds),
    ])
    for (const q of quests ?? []) questTitles[q.id] = q.title
    for (const q of partnerQuests ?? []) questTitles[q.id] = q.title
  }
  const questBreakdown = rpcRows.map(r => ({
    questId: r.quest_id as string,
    title: questTitles[r.quest_id as string] || 'Unknown Quest',
    count: Number(r.count),
  }))

  return NextResponse.json({
    kpis: {
      passHolders,
      totalWallets,
      conversionRate: totalWallets > 0 ? (passHolders / totalWallets) * 100 : 0,
      questClaims,
      activeWallets7d,
      savers10:  savers10Res.count  ?? 0,
      savers30:  savers30Res.count  ?? 0,
      savers100: savers100Res.count ?? 0,
      changes: {
        passHolders:   pct(passHolders, prevPassHolders),
        totalWallets:  null,
        questClaims:   pct(questClaims, prevQuestClaims),
        activeWallets7d: pct(activeWallets7d, prevActiveWallets),
      },
    },
    passAdoption,
    weeklyActive,
    questBreakdown,
    raffle: {
      totalRounds:       raffleStats.totalRounds,
      totalUSDT:         raffleStats.totalUSDT,
      totalAKIBA:        raffleStats.totalAKIBA,
      totalPointsSpent:  raffleStats.totalPointsSpent,
      totalParticipations: raffleStats.totalParticipations,
      weekly:            raffleWeekly,
    },
  })
}
