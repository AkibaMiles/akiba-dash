export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { QUEST_IDS } from '@/lib/constants'
import { archivedClaimsForUsers } from '@/lib/engagement-archive'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = req.nextUrl

  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const search = searchParams.get('search') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const sortBy = searchParams.get('sortBy') || 'claimed_at'
  const sortDir = searchParams.get('sortDir') === 'asc' ? true : false

  // Fetch all pass holders from passport_ops
  let opsQuery = supabase
    .from('passport_ops')
    .select('address, created_at, amount')
    .eq('type', 'burn')
    .eq('status', 'completed')
    .order('created_at', { ascending: sortDir })

  if (from) opsQuery = opsQuery.gte('created_at', from)
  if (to) opsQuery = opsQuery.lte('created_at', to + 'T23:59:59Z')
  if (search) opsQuery = opsQuery.ilike('address', `%${search}%`)

  const { data: ops, count: totalCount } = await supabase
    .from('passport_ops')
    .select('address, created_at, amount', { count: 'exact' })
    .eq('type', 'burn')
    .eq('status', 'completed')
    .ilike('address', search ? `%${search}%` : '%')
    .gte('created_at', from ? from : '2000-01-01')
    .lte('created_at', to ? to + 'T23:59:59Z' : '2100-01-01')
    .order('created_at', { ascending: sortDir })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const addresses = (ops ?? []).map(o => o.address as string)

  if (addresses.length === 0) {
    return NextResponse.json({ data: [], total: totalCount ?? 0 })
  }

  // Parallel: referrers, quest claim counts, streaks
  const [usersRes, claimCountsRes, streak10Res, streak30Res] = await Promise.all([
    supabase.from('users').select('user_address, referrer_address').in('user_address', addresses),
    supabase.from('daily_engagements').select('user_address').in('user_address', addresses),
    supabase
      .from('streaks')
      .select('user_address, current_streak')
      .in('user_address', addresses)
      .eq('quest_id', QUEST_IDS.BALANCE_STREAK_10),
    supabase
      .from('streaks')
      .select('user_address, current_streak')
      .in('user_address', addresses)
      .eq('quest_id', QUEST_IDS.BALANCE_STREAK_30),
  ])

  // Build lookup maps
  const referrers: Record<string, string | null> = {}
  for (const u of usersRes.data ?? []) referrers[u.user_address] = u.referrer_address

  const archivedClaims = archivedClaimsForUsers(addresses)
  const claimCounts: Record<string, number> = { ...archivedClaims }
  for (const c of claimCountsRes.data ?? []) {
    const a = c.user_address as string
    claimCounts[a] = (claimCounts[a] ?? 0) + 1
  }

  const streak10: Record<string, number> = {}
  for (const s of streak10Res.data ?? []) streak10[s.user_address] = s.current_streak

  const streak30: Record<string, number> = {}
  for (const s of streak30Res.data ?? []) streak30[s.user_address] = s.current_streak

  const data = (ops ?? []).map(op => ({
    address: op.address,
    claimedAt: op.created_at,
    referrer: referrers[op.address as string] ?? null,
    totalQuestClaims: claimCounts[op.address as string] ?? 0,
    streak10: streak10[op.address as string] ?? 0,
    streak30: streak30[op.address as string] ?? 0,
  }))

  return NextResponse.json({ data, total: totalCount ?? 0 })
}
