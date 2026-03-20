import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { QUEST_IDS } from '@/lib/constants'

function weekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = req.nextUrl
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // --- Funnel ---
  const [
    totalWalletsRes,
    walletsWithClaimsRes,
    passHoldersRes,
    streak10Res,
    streak30Res,
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('daily_engagements').select('user_address'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_member', true),
    supabase.from('streaks').select('user_address').eq('quest_id', QUEST_IDS.BALANCE_STREAK_10).gt('current_streak', 0),
    supabase.from('streaks').select('user_address').eq('quest_id', QUEST_IDS.BALANCE_STREAK_30).gt('current_streak', 0),
  ])

  const walletsWithClaims = new Set(walletsWithClaimsRes.data?.map(r => r.user_address as string) ?? []).size
  const streak10Count = new Set(streak10Res.data?.map(r => r.user_address as string) ?? []).size
  const streak30Count = new Set(streak30Res.data?.map(r => r.user_address as string) ?? []).size

  const funnel = [
    { step: 'Registered Wallets', count: totalWalletsRes.count ?? 0 },
    { step: 'Wallets with ≥1 Quest', count: walletsWithClaims },
    { step: 'Prosperity Pass Holders', count: passHoldersRes.count ?? 0 },
    { step: 'Active $10 Balance Streak', count: streak10Count },
    { step: 'Active $30 Balance Streak', count: streak30Count },
  ]

  // --- Streak Health ---
  const { data: streakRows } = await supabase
    .from('streaks')
    .select('user_address, quest_id, current_streak, longest_streak, last_scope_key, scope')
    .order('current_streak', { ascending: false })
    .limit(200)

  const streakHealth = (streakRows ?? []).map(r => ({
    address: r.user_address as string,
    questId: r.quest_id as string,
    scope: r.scope as string,
    currentStreak: r.current_streak as number,
    longestStreak: r.longest_streak as number,
    lastScopeKey: r.last_scope_key as string,
    broken: (r.last_scope_key as string) < yesterday,
  }))

  // --- Cohort Analysis (last 10 cohort weeks) ---
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

  const { data: allEngagements } = await supabase
    .from('daily_engagements')
    .select('user_address, claimed_at')
    .gte('claimed_at', ninetyDaysAgo)
    .order('claimed_at')

  const rows = allEngagements ?? []

  // Find each wallet's first engagement date in our window
  const firstSeen: Record<string, string> = {}
  for (const r of rows) {
    const a = r.user_address as string
    const d = r.claimed_at as string
    if (!firstSeen[a] || d < firstSeen[a]) firstSeen[a] = d
  }

  // Group wallets into cohort weeks
  const cohortWallets: Record<string, Set<string>> = {}
  for (const [addr, date] of Object.entries(firstSeen)) {
    const wk = weekKey(date)
    if (!cohortWallets[wk]) cohortWallets[wk] = new Set()
    cohortWallets[wk].add(addr)
  }

  // For each cohort, track which wallets engaged in week N after cohort start
  const cohortWeeks = Object.keys(cohortWallets).sort().slice(-10) // last 10 cohorts
  const NUM_WEEKS = 8

  const cohortTable = cohortWeeks.map(cohortWeek => {
    const wallets = cohortWallets[cohortWeek]
    const cohortStartDate = `${cohortWeek.split('-W')[0]}-01-01` // approximate

    const weekRetention: (number | null)[] = Array.from({ length: NUM_WEEKS + 1 }, (_, wi) => {
      const weekStart = addWeeks(cohortStartDate, wi)
      const weekEnd = addWeeks(cohortStartDate, wi + 1)

      // Find wallets in this cohort that had an engagement in week wi
      const activeInWeek = new Set(
        rows
          .filter(r => {
            const d = r.claimed_at as string
            return d >= weekStart && d < weekEnd && wallets.has(r.user_address as string)
          })
          .map(r => r.user_address as string),
      )

      if (wi === 0) return 100
      const todayDate = new Date().toISOString().split('T')[0]
      if (weekStart > todayDate) return null
      return wallets.size > 0 ? Math.round((activeInWeek.size / wallets.size) * 100) : 0
    })

    return {
      cohortWeek,
      size: wallets.size,
      retention: weekRetention,
    }
  })

  return NextResponse.json({ funnel, cohortTable, streakHealth })
}
