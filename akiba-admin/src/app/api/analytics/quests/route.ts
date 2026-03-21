import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = req.nextUrl

  const today = new Date().toISOString().split('T')[0]
  const questId = searchParams.get('questId')

  // Active quests
  const { data: quests, error: questsError } = await supabase
    .from('quests')
    .select('id, title, description, reward_points')
    .eq('is_active', true)

  if (questsError) {
    return NextResponse.json({ error: questsError.message }, { status: 500 })
  }

  if (!quests || quests.length === 0) {
    return NextResponse.json({ questCards: [], heatmap: [] })
  }

  const questIds = quests.map(q => q.id as string)

  // Two RPC calls replace 78+ parallel HEAD queries (which overwhelm Supabase connection pool)
  const [questStatsRes, heatmapRes] = await Promise.all([
    supabase.rpc('get_quest_stats', { quest_ids: questIds }),
    supabase.rpc('get_engagement_heatmap', { days_back: 90 }),
  ])

  if (questStatsRes.error) {
    return NextResponse.json(
      { error: `RPC error: ${questStatsRes.error.message}. Run the SQL setup in the README first.` },
      { status: 500 },
    )
  }

  const allTimeCounts: Record<string, number> = {}
  const todayCounts: Record<string, number> = {}
  const weekCounts: Record<string, number> = {}
  const uniqueClaimersMap: Record<string, number> = {}

  for (const row of (questStatsRes.data ?? [])) {
    const qid = row.quest_id as string
    allTimeCounts[qid]    = Number(row.de_total) + Number(row.pe_total)
    todayCounts[qid]      = Number(row.de_today) + Number(row.pe_today)
    weekCounts[qid]       = Number(row.de_week)  + Number(row.pe_week)
    // de_unique/pe_unique only present if function includes DISTINCT (optional)
    const r = row as Record<string, unknown>
    uniqueClaimersMap[qid]= Number(r.de_unique ?? 0) + Number(r.pe_unique ?? 0)
  }

  const questCards = quests.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    rewardPoints: q.reward_points,
    totalClaims:    allTimeCounts[q.id]     ?? 0,
    uniqueClaimers: uniqueClaimersMap[q.id] ?? 0,
    claimsToday:    todayCounts[q.id]       ?? 0,
    claimsThisWeek: weekCounts[q.id]        ?? 0,
  }))

  type HeatRow = { dt: string; cnt: number }
  const heatmap = ((heatmapRes.data ?? []) as HeatRow[]).map((r) => ({ date: r.dt, count: Number(r.cnt) }))

  // Optional drill-down for a specific quest
  if (questId) {
    const thirtyDaysAgo = daysAgo(30)
    const [
      deDailyDrill, peDailyDrill,
      deTopWallets, peTopWallets,
      streakDistRes,
    ] = await Promise.all([
      supabase.from('daily_engagements').select('claimed_at, user_address').eq('quest_id', questId).gte('claimed_at', thirtyDaysAgo).lte('claimed_at', today).limit(50000),
      supabase.from('partner_engagements').select('claimed_at, user_address').eq('partner_quest_id', questId).gte('claimed_at', thirtyDaysAgo).lte('claimed_at', today).limit(50000),
      supabase.from('daily_engagements').select('user_address').eq('quest_id', questId).limit(500000),
      supabase.from('partner_engagements').select('user_address').eq('partner_quest_id', questId).limit(500000),
      supabase.from('streaks').select('current_streak').eq('quest_id', questId).gt('current_streak', 0),
    ])

    const dailyMap: Record<string, number> = {}
    for (const r of [...(deDailyDrill.data ?? []), ...(peDailyDrill.data ?? [])]) {
      const d = r.claimed_at as string
      dailyMap[d] = (dailyMap[d] ?? 0) + 1
    }
    const dailyClaims = Object.keys(dailyMap).sort().map(date => ({ date, count: dailyMap[date] }))

    const walletCounts: Record<string, number> = {}
    for (const r of [...(deTopWallets.data ?? []), ...(peTopWallets.data ?? [])]) {
      const a = r.user_address as string
      walletCounts[a] = (walletCounts[a] ?? 0) + 1
    }
    const topWallets = Object.entries(walletCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([address, count]) => ({ address, count }))

    const buckets: Record<string, number> = { '1': 0, '2–5': 0, '6–14': 0, '15–30': 0, '30+': 0 }
    for (const r of streakDistRes.data ?? []) {
      const s = r.current_streak as number
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
