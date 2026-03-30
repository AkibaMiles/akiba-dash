export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, type Abi, type Address } from 'viem'
import { celo } from 'viem/chains'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ONCHAIN_QUEST_IDS, SAVINGS_QUEST_IDS } from '@/lib/constants'
import { fetchDuneRaffleStats } from '@/lib/dune'
import { archivedCountsInRange } from '@/lib/engagement-archive'
import diceAbi from '@/lib/abi/akibadice.json'

const DICE_CONTRACT = '0xf77e7395Aa5c89BcC8d6e23F67a9c7914AB9702a' as Address
const DICE_TIERS = [10, 20, 30] as const

const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
})

const KILN_QUEST_ID = '9ca81915-8707-43c9-9472-9faed0c7cc58'

const SAVINGS_TIER_AMOUNTS: Record<string, number> = {
  'feb6e5ef-7d9c-4ca6-a042-e2b692a6b00f': 10,
  'a1ac5914-20d4-4436-bf02-29563938fe9d': 30,
  'b5c7e1d2-6f8a-4b0c-9d2e-3a1f7c5b8e4d': 100,
}

const QUEST_MIN_TRANSFER: Record<string, number> = {
  '383eaa90-75aa-4592-a783-ad9126e8f04d': 1, // Transact
}

const QUEST_LABELS: Record<string, string> = {
  'feb6e5ef-7d9c-4ca6-a042-e2b692a6b00f': 'Save $10',
  'a1ac5914-20d4-4436-bf02-29563938fe9d': 'Save $30',
  'b5c7e1d2-6f8a-4b0c-9d2e-3a1f7c5b8e4d': 'Save $100',
  '9ca81915-8707-43c9-9472-9faed0c7cc58': 'Hold $10 Kiln',
  '383eaa90-75aa-4592-a783-ad9126e8f04d': 'Transact',
  'f6d027d2-bf52-4768-a87f-2be00a5b03a0': 'Make 5 Txns',
  'ea001296-2405-451b-a590-941af22a8df1': '10 Transactions',
  '60320fa4-1681-4795-8818-429f11afe784': '20 Transactions',
  'c6b14ae1-66e9-4777-9c9f-65e57b091b16': 'Topup MiniPay',
  '96009afb-0762-4399-adb3-ced421d73072': 'Weekly Top-Up',
  '6ddc811a-1a4d-4e57-871d-836f07486531': '7 Day Streak',
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = req.nextUrl

  const today = new Date().toISOString().split('T')[0]
  const to  = searchParams.get('to')   || today
  const from = searchParams.get('from') || null  // null = all-time

  const diceCalls = DICE_TIERS.map(tier => ({
    address: DICE_CONTRACT,
    abi: diceAbi as Abi,
    functionName: 'getTierStats',
    args: [BigInt(tier)],
  }))

  const dateGte = from ?? '2000-01-01'
  const dateLte = to + 'T23:59:59Z'

  const [
    onchainStatsRes,
    burnedRes,
    refundRes,
    pendingRes,
    raffleStats,
    diceResults,
    allDeRes,
    allPeRes,
  ] = await Promise.all([
    supabase.rpc('get_onchain_quest_stats', {
      p_quest_ids: [...ONCHAIN_QUEST_IDS],
      from_ts: from ?? null,
      to_ts: from ? dateLte : null,
    }),
    supabase.from('passport_ops').select('amount').eq('type', 'burn').eq('status', 'completed')
      .gte('created_at', dateGte).lte('created_at', dateLte),
    supabase.from('passport_ops').select('*', { count: 'exact', head: true }).eq('type', 'refund').eq('status', 'completed')
      .gte('created_at', dateGte).lte('created_at', dateLte),
    supabase.from('mint_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    fetchDuneRaffleStats(from ?? undefined, to),
    publicClient.multicall({ contracts: diceCalls }).catch(() => null),
    supabase.from('daily_engagements').select('*', { count: 'exact', head: true })
      .gte('claimed_at', dateGte).lte('claimed_at', dateLte),
    supabase.from('partner_engagements').select('*', { count: 'exact', head: true })
      .gte('claimed_at', dateGte).lte('claimed_at', dateLte),
  ])

  const statsMap: Record<string, { total_claims: number; unique_wallets: number; active_streakers: number }> = {}
  for (const row of onchainStatsRes.data ?? []) {
    statsMap[row.quest_id as string] = {
      total_claims:     Number(row.total_claims),
      unique_wallets:   Number(row.unique_wallets),
      active_streakers: Number(row.active_streakers),
    }
  }

  const savings = SAVINGS_QUEST_IDS.map(id => ({
    questId: id,
    label: QUEST_LABELS[id] ?? id,
    tierAmount:    SAVINGS_TIER_AMOUNTS[id] ?? 0,
    activeHolders: statsMap[id]?.active_streakers ?? 0,
    totalClaims:   statsMap[id]?.total_claims     ?? 0,
    uniqueWallets: statsMap[id]?.unique_wallets   ?? 0,
  }))

  const kiln = {
    questId:      KILN_QUEST_ID,
    label:        QUEST_LABELS[KILN_QUEST_ID],
    activeHolders: statsMap[KILN_QUEST_ID]?.active_streakers ?? 0,
    totalClaims:   statsMap[KILN_QUEST_ID]?.total_claims     ?? 0,
    uniqueWallets: statsMap[KILN_QUEST_ID]?.unique_wallets   ?? 0,
  }

  const txQuestIds = ONCHAIN_QUEST_IDS.filter(
    id => !(SAVINGS_QUEST_IDS as readonly string[]).includes(id) && id !== KILN_QUEST_ID,
  )
  const txActivity = txQuestIds.map(id => ({
    questId: id,
    label: QUEST_LABELS[id] ?? id,
    totalClaims:   statsMap[id]?.total_claims   ?? 0,
    uniqueWallets: statsMap[id]?.unique_wallets ?? 0,
    minTransfer:   QUEST_MIN_TRANSFER[id] ?? null,
  })).sort((a, b) => b.totalClaims - a.totalClaims)

  const totalBurned = (burnedRes.data ?? []).reduce((s, r) => s + (r.amount as number), 0)

  const diceTiers = DICE_TIERS.map((tier, i) => {
    const result = diceResults?.[i]
    if (!result || result.status !== 'success') {
      return { tier, roundsCreated: 0, roundsResolved: 0, totalStaked: 0, totalPayout: 0 }
    }
    const [roundsCreated, roundsResolved, totalStaked, totalPayout] = result.result as [bigint, bigint, bigint, bigint]
    return {
      tier,
      roundsCreated:  Number(roundsCreated),
      roundsResolved: Number(roundsResolved),
      totalStaked:    Number(totalStaked)  / 1e18,
      totalPayout:    Number(totalPayout)  / 1e18,
    }
  })

  const archivedDe = archivedCountsInRange('daily_engagements',   from, to)
  const archivedPe = archivedCountsInRange('partner_engagements', from, to)
  const totalQuestClaims =
    (allDeRes.count ?? 0) + archivedDe +
    (allPeRes.count ?? 0) + archivedPe
  const estimatedTotalTxns = totalQuestClaims + raffleStats.totalParticipations

  return NextResponse.json({
    savings,
    kiln,
    txActivity,
    summary: {
      totalQuestClaims,
      totalSavers: savings.reduce((s, r) => s + r.activeHolders, 0),
      estimatedTotalTxns,
    },
    passport: {
      totalBurned,
      refundCount:  refundRes.count  ?? 0,
      pendingQueue: pendingRes.count ?? 0,
    },
    raffle: {
      totalRounds:          raffleStats.totalRounds,
      totalUSDT:            raffleStats.totalUSDT,
      totalAKIBA:           raffleStats.totalAKIBA,
      totalPointsSpent:     raffleStats.totalPointsSpent,
      totalParticipations:  raffleStats.totalParticipations,
      usdtRounds:           raffleStats.usdtRounds,
      akibaRounds:          raffleStats.akibaRounds,
      usdtParticipations:   raffleStats.usdtParticipations,
      akibaParticipations:  raffleStats.akibaParticipations,
    },
    dice: diceTiers,
  })
}
