export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = req.nextUrl

  const today = new Date().toISOString().split('T')[0]
  const to   = searchParams.get('to')   || today
  const from = searchParams.get('from') || daysAgo(30)
  const questId = searchParams.get('questId')

  // Fetch both regular and partner quests
  const [{ data: quests, error: questsError }, { data: partnerQuests }] = await Promise.all([
    supabase.from('quests').select('id, title, description, reward_points').eq('is_active', true),
    supabase.from('partner_quests').select('id, title, description, reward_points'),
  ])

  if (questsError) {
    return NextResponse.json({ error: questsError.message }, { status: 500 })
  }

  const allQuests = [
    ...(quests ?? []).map(q => ({ ...q, isPartner: false })),
    ...(partnerQuests ?? []).map(q => ({ ...q, isPartner: true })),
  ]

  if (allQuests.length === 0) {
    return NextResponse.json({ questCards: [], heatmap: [] })
  }

  const allQuestIds = allQuests.map(q => q.id as string)

  const [questStatsRes, heatmapRes, periodBreakdownRes] = await Promise.all([
    supabase.rpc('get_quest_stats', { quest_ids: allQuestIds }),
    supabase.rpc('get_engagement_heatmap', { days_back: 90 }),
    supabase.rpc('get_quest_claim_breakdown', { from_ts: from, to_ts: to + 'T23:59:59Z' }),
  ])

  if (questStatsRes.error) {
    return NextResponse.json(
      { error: `RPC error: ${questStatsRes.error.message}. Run the SQL setup in the README first.` },
      { status: 500 },
    )
  }

  type StatsRow    = { quest_id: string; de_total: number; pe_total: number; de_unique: number; pe_unique: number }
  type PeriodRow   = { quest_id: string; count: number }

  const allTimeCounts: Record<string, number> = {}
  const uniqueClaimersMap: Record<string, number> = {}

  for (const row of (questStatsRes.data ?? []) as StatsRow[]) {
    allTimeCounts[row.quest_id]     = Number(row.de_total) + Number(row.pe_total)
    uniqueClaimersMap[row.quest_id] = Number(row.de_unique ?? 0) + Number(row.pe_unique ?? 0)
  }

  const periodCounts: Record<string, number> = {}
  for (const row of (periodBreakdownRes.data ?? []) as PeriodRow[]) {
    periodCounts[row.quest_id] = Number(row.count)
  }

  const questCards = allQuests.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    rewardPoints: q.reward_points,
    isPartner: q.isPartner,
    totalClaims:    allTimeCounts[q.id]     ?? 0,
    uniqueClaimers: uniqueClaimersMap[q.id] ?? 0,
    periodClaims:   periodCounts[q.id]      ?? 0,
  })).sort((a, b) => b.totalClaims - a.totalClaims)

  type HeatRow = { dt: string; cnt: number }
  const heatmap = ((heatmapRes.data ?? []) as HeatRow[]).map(r => ({ date: r.dt, count: Number(r.cnt) }))

  // Optional drill-down for a specific quest
  if (questId) {
    const [dailyClaimsRes, topWalletsRes, streakDistRes] = await Promise.all([
      supabase.rpc('get_quest_daily_claims', { p_quest_id: questId, from_ts: from, to_ts: to + 'T23:59:59Z' }),
      supabase.rpc('get_quest_top_wallets', { p_quest_id: questId }),
      supabase.from('streaks').select('current_streak').eq('quest_id', questId).gt('current_streak', 0),
    ])

    type DailyRow  = { date: string; count: number }
    type WalletRow = { address: string; count: number }
    type StreakRow  = { current_streak: number }

    const dailyClaims = ((dailyClaimsRes.data ?? []) as DailyRow[]).map(r => ({ date: r.date, count: Number(r.count) }))

    const topWallets = ((topWalletsRes.data ?? []) as WalletRow[]).map(r => ({ address: r.address, count: Number(r.count) }))

    const buckets: Record<string, number> = { '1': 0, '2–5': 0, '6–14': 0, '15–30': 0, '30+': 0 }
    for (const r of (streakDistRes.data ?? []) as StreakRow[]) {
      const s = r.current_streak
      if (s === 1)      buckets['1']++
      else if (s <= 5)  buckets['2–5']++
      else if (s <= 14) buckets['6–14']++
      else if (s <= 30) buckets['15–30']++
      else              buckets['30+']++
    }
    const streakDistribution = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }))

    return NextResponse.json({ questCards, heatmap, drillDown: { dailyClaims, topWallets, streakDistribution } })
  }

  return NextResponse.json({ questCards, heatmap })
}
