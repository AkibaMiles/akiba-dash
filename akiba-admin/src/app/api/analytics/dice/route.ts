export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createPublicClient, http, type Abi, type Address } from 'viem'
import { celo } from 'viem/chains'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import diceAbi from '@/lib/abi/akibadice.json'

const DICE_CONTRACT = '0xf77e7395Aa5c89BcC8d6e23F67a9c7914AB9702a' as Address
const DICE_TIERS = [10, 20, 30] as const
const GAMES_SUBGRAPH_URL = process.env.GAMES_SUBGRAPH_URL

const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
})

async function gamesGql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  if (!GAMES_SUBGRAPH_URL) return null
  try {
    const res = await fetch(GAMES_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    })
    const json = await res.json()
    if (json.errors) return null
    return json.data as T
  } catch {
    return null
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin()

  // ─── 1. Contract: tier stats (3 calls via multicall) ────────────────────────
  const tierCalls = DICE_TIERS.map(tier => ({
    address: DICE_CONTRACT,
    abi: diceAbi as Abi,
    functionName: 'getTierStats' as const,
    args: [BigInt(tier)],
  }))

  const [tierResults, streakRes] = await Promise.all([
    publicClient.multicall({ allowFailure: true, contracts: tierCalls }),
    supabase
      .from('streaks')
      .select('user_address, current_streak, longest_streak, last_scope_key, quest_id')
      .gt('current_streak', 0)
      .limit(500000),
  ])

  const tierStats = DICE_TIERS.map((tier, i) => {
    const r = tierResults[i]
    if (r.status !== 'success') return { tier, roundsCreated: 0, roundsResolved: 0, totalStaked: '0', totalPayout: '0' }
    const [roundsCreated, roundsResolved, totalStaked, totalPayout] = r.result as [bigint, bigint, bigint, bigint]
    return {
      tier,
      roundsCreated: Number(roundsCreated),
      roundsResolved: Number(roundsResolved),
      totalStaked: totalStaked.toString(),
      totalPayout: totalPayout.toString(),
    }
  })

  // ─── 2. Active game streakers from Supabase ──────────────────────────────────
  // Join with quests to find the game streak quest
  const { data: gameQuests } = await supabase
    .from('quests')
    .select('id')
    .ilike('title', '%game%')

  const gameQuestIds = (gameQuests ?? []).map(q => q.id as string)
  const gameStreakWallets = gameQuestIds.length > 0
    ? new Set(
        (streakRes.data ?? [])
          .filter(r => gameQuestIds.includes(r.quest_id as string))
          .map(r => r.user_address as string)
      ).size
    : 0

  // ─── 3. Game streak leaderboard (top 50) ─────────────────────────────────────
  let gameStreaks: { user_address: string; current_streak: number; longest_streak: number; last_scope_key: string | null }[] = []
  if (gameQuestIds.length > 0) {
    const { data: streakData } = await supabase
      .from('streaks')
      .select('user_address, current_streak, longest_streak, last_scope_key')
      .in('quest_id', gameQuestIds)
      .gt('current_streak', 0)
      .order('current_streak', { ascending: false })
      .limit(50)
    gameStreaks = (streakData ?? []).map(r => ({
      user_address: r.user_address as string,
      current_streak: r.current_streak as number,
      longest_streak: r.longest_streak as number,
      last_scope_key: r.last_scope_key as string | null,
    }))
  }

  // ─── 4. Subgraph: daily active players (last 30 days) ────────────────────────
  const since = Math.floor(Date.now() / 1000) - 30 * 86400
  type JoinRow = { player: string; timestamp: string }
  const joinsData = await gamesGql<{ gameJoins: JoinRow[] }>(
    `query($since: BigInt!) {
      gameJoins(first: 1000, where: { timestamp_gte: $since }, orderBy: timestamp, orderDirection: asc) {
        player
        timestamp
      }
    }`,
    { since: since.toString() },
  )

  let dailyActivePlayers: { date: string; count: number }[] = []
  if (joinsData?.gameJoins) {
    const dayMap: Record<string, Set<string>> = {}
    for (const j of joinsData.gameJoins) {
      const d = new Date(Number(j.timestamp) * 1000).toISOString().split('T')[0]
      if (!dayMap[d]) dayMap[d] = new Set()
      dayMap[d].add(j.player.toLowerCase())
    }
    dailyActivePlayers = Object.keys(dayMap).sort().map(date => ({ date, count: dayMap[date].size }))
  }

  // ─── 5. Subgraph: top winners ────────────────────────────────────────────────
  type PlayerRow = { player: string }
  const playersData = await gamesGql<{ gameJoins: PlayerRow[] }>(
    `{ gameJoins(first: 1000, orderBy: timestamp, orderDirection: desc) { player } }`,
  )

  let topWinners: {
    address: string; roundsJoined: number; roundsWon: number; totalStaked: string; totalWon: string
  }[] = []

  if (playersData?.gameJoins) {
    const uniquePlayers = [...new Set(playersData.gameJoins.map(j => j.player.toLowerCase() as Address))]
    const playerCalls = uniquePlayers.map(addr => ({
      address: DICE_CONTRACT,
      abi: diceAbi as Abi,
      functionName: 'getPlayerStats' as const,
      args: [addr],
    }))

    const playerResults = await publicClient.multicall({ allowFailure: true, contracts: playerCalls })

    const winners = uniquePlayers
      .map((addr, i) => {
        const r = playerResults[i]
        if (r.status !== 'success') return null
        const [roundsJoined, roundsWon, totalStaked, totalWon] = r.result as [bigint, bigint, bigint, bigint]
        return {
          address: addr,
          roundsJoined: Number(roundsJoined),
          roundsWon: Number(roundsWon),
          totalStaked: totalStaked.toString(),
          totalWon: totalWon.toString(),
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null && w.roundsJoined > 0)
      .sort((a, b) => BigInt(b.totalWon) > BigInt(a.totalWon) ? 1 : -1)
      .slice(0, 20)

    topWinners = winners
  }

  return NextResponse.json({
    tierStats,
    gameStreakWallets,
    gameStreaks,
    dailyActivePlayers,
    topWinners,
    subgraphAvailable: !!GAMES_SUBGRAPH_URL,
  })
}
