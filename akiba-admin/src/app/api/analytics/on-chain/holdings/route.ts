export const revalidate = 900 // 15-min cache — multicall reads are expensive

import { NextResponse } from 'next/server'
import { createPublicClient, http, type Address } from 'viem'
import { celo } from 'viem/chains'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { SAVINGS_QUEST_IDS, QUEST_IDS } from '@/lib/constants'

const KILN_QUEST_ID = '9ca81915-8707-43c9-9472-9faed0c7cc58'
const KILN_TOKEN    = '0xbaD4711D689329E315Be3E7C1C64CF652868C56c' as Address
const KILN_DECIMALS = 6

// Stablecoin contracts on Celo — verify against the MiniPay token list if results look off
const STABLECOINS: { address: Address; decimals: number }[] = [
  { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 }, // cUSD
  { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6  }, // USDC
  { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6  }, // USDT
]

const BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
})

const CHUNK = 500

async function multicallBalances(
  wallets: Address[],
  tokenAddress: Address,
  decimals: number,
): Promise<number[]> {
  const results: number[] = []
  for (let i = 0; i < wallets.length; i += CHUNK) {
    const chunk = wallets.slice(i, i + CHUNK)
    const calls = chunk.map(wallet => ({
      address: tokenAddress,
      abi: BALANCE_OF_ABI,
      functionName: 'balanceOf' as const,
      args: [wallet] as const,
    }))
    const res = await publicClient.multicall({ contracts: calls })
    for (const r of res) {
      results.push(r.status === 'success' ? Number(r.result as bigint) / 10 ** decimals : 0)
    }
  }
  return results
}

async function getStreakWallets(supabase: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>, questId: string): Promise<Address[]> {
  const { data } = await supabase
    .from('streaks')
    .select('user_address')
    .eq('quest_id', questId)
    .gt('current_streak', 0)
  return (data ?? []).map(r => r.user_address as Address).filter(Boolean)
}

async function getEngagementWallets(supabase: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>, questId: string): Promise<Address[]> {
  const { data } = await supabase
    .from('daily_engagements')
    .select('user_address')
    .eq('quest_id', questId)
  const unique = Array.from(new Set((data ?? []).map(r => r.user_address as string).filter(Boolean)))
  return unique as Address[]
}

export async function GET() {
  const supabase = getSupabaseAdmin()

  const [savingsWalletsByQuest, kilnWallets] = await Promise.all([
    Promise.all(SAVINGS_QUEST_IDS.map(async id => [id, await getStreakWallets(supabase, id)] as const)),
    getEngagementWallets(supabase, KILN_QUEST_ID),
  ])

  const walletsByQuest = Object.fromEntries(savingsWalletsByQuest) as Record<string, Address[]>

  const TIER_LABEL: Record<string, string> = {
    [QUEST_IDS.BALANCE_STREAK_10]:  '$10',
    [QUEST_IDS.BALANCE_STREAK_30]:  '$30',
    [QUEST_IDS.BALANCE_STREAK_100]: '$100',
  }

  // Deduplicate all savings wallets, multicall once
  const allSavingsWallets = Array.from(
    new Set(SAVINGS_QUEST_IDS.flatMap(id => walletsByQuest[id] ?? [])),
  )

  const savingsBalsByToken = await Promise.all(
    STABLECOINS.map(t => multicallBalances(allSavingsWallets, t.address, t.decimals)),
  )

  // wallet → total stablecoin balance
  const walletBalance = new Map(
    allSavingsWallets.map((w, i) => [
      w,
      Math.round(savingsBalsByToken.reduce((sum, tb) => sum + tb[i], 0) * 100) / 100,
    ]),
  )

  // Per-tier stats (re-use balance map)
  const savings = SAVINGS_QUEST_IDS.map(id => {
    const wallets   = walletsByQuest[id] ?? []
    const totals    = wallets.map(w => walletBalance.get(w) ?? 0)
    const totalHeld = totals.reduce((s, v) => s + v, 0)
    return {
      questId:     id,
      walletCount: wallets.length,
      totalHeld:   Math.round(totalHeld * 100) / 100,
      avgHeld:     wallets.length > 0 ? Math.round((totalHeld / wallets.length) * 100) / 100 : 0,
    }
  })

  // wallet → which tiers they're active in
  const walletTiers = new Map<string, string[]>()
  for (const id of SAVINGS_QUEST_IDS) {
    for (const w of walletsByQuest[id] ?? []) {
      if (!walletTiers.has(w)) walletTiers.set(w, [])
      walletTiers.get(w)!.push(TIER_LABEL[id])
    }
  }

  // Top 20 savers across all tiers
  const topSavers = Array.from(walletBalance.entries())
    .map(([address, balance]) => ({ address, balance, tiers: walletTiers.get(address) ?? [] }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 20)

  // Kiln: balanceOf on share token (uses all-time claimers, not streak-based)
  // kilnWallets already fetched from daily_engagements above
  let kiln = { walletCount: 0, totalHeld: 0, avgHeld: 0, topHolders: [] as { address: string; balance: number }[] }

  if (kilnWallets.length > 0) {
    const bals      = await multicallBalances(kilnWallets, KILN_TOKEN, KILN_DECIMALS)
    const totalHeld = bals.reduce((s, v) => s + v, 0)
    kiln = {
      walletCount: kilnWallets.length,
      totalHeld:   Math.round(totalHeld * 100) / 100,
      avgHeld:     Math.round((totalHeld / kilnWallets.length) * 100) / 100,
      topHolders:  kilnWallets
        .map((address, i) => ({ address, balance: Math.round(bals[i] * 100) / 100 }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3),
    }
  }

  return NextResponse.json({ savings, topSavers, kiln })
}
