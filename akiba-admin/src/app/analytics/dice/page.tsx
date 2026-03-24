'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import { Dices, RefreshCw, Flame, Trophy, BarChart2 } from 'lucide-react'
import { AKIBA_TEAL } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────
type TierStat = {
  tier: 10 | 20 | 30
  roundsCreated: number
  roundsResolved: number
  totalStaked: string
  totalPayout: string
}
type DayPoint = { date: string; count: number }
type Winner = { address: string; roundsJoined: number; roundsWon: number; totalStaked: string; totalWon: string }
type StreakRow = { user_address: string; current_streak: number; longest_streak: number; last_scope_key: string | null }
type DiceData = {
  tierStats: TierStat[]
  gameStreakWallets: number
  gameStreaks: StreakRow[]
  dailyActivePlayers: DayPoint[]
  topWinners: Winner[]
  subgraphAvailable: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ONE_E18 = 1_000_000_000_000_000_000n

function formatMiles(raw: string): string {
  const n = BigInt(raw)
  const whole = n >= ONE_E18 ? n / ONE_E18 : 0n
  return Number(whole).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function shortAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

const TIER_COLORS: Record<number, string> = {
  10: '#238D9D',
  20: '#1a6d7a',
  30: '#135059',
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    fontSize: 12,
    padding: '8px 12px',
  },
  cursor: { fill: 'rgba(35,141,157,0.06)' },
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, icon: Icon, color = 'teal',
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color?: 'teal' | 'amber' | 'violet' | 'green'
}) {
  const colors = {
    teal:   { bg: 'bg-[#238D9D]/10', text: 'text-[#238D9D]', border: 'border-t-[#238D9D]' },
    amber:  { bg: 'bg-amber-50',     text: 'text-amber-600',  border: 'border-t-amber-400' },
    violet: { bg: 'bg-violet-50',    text: 'text-violet-600', border: 'border-t-violet-400' },
    green:  { bg: 'bg-emerald-50',   text: 'text-emerald-600',border: 'border-t-emerald-400' },
  }[color]
  return (
    <div className={`rounded-xl border-t-[3px] ${colors.border} bg-white border border-gray-200 p-5 shadow-sm`}>
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${colors.bg}`}>
        <Icon size={16} className={colors.text} />
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-600">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Per-Tier Card ────────────────────────────────────────────────────────────
function TierCard({ stat }: { stat: TierStat }) {
  const color = TIER_COLORS[stat.tier]
  const completionPct = stat.roundsCreated > 0
    ? Math.round((stat.roundsResolved / stat.roundsCreated) * 100)
    : 0
  const payout = formatMiles(stat.totalPayout)

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderTopWidth: 3, borderTopColor: color }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: color + '20' }}>
          <Dices size={15} style={{ color }} />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{stat.tier} Miles Tier</p>
          <p className="text-xs text-gray-400">{stat.roundsCreated} rounds created</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <p className="text-xs text-gray-400">Miles Paid Out</p>
          <p className="font-semibold text-gray-800 tabular-nums">{payout} M</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Resolved</p>
          <p className="font-semibold text-gray-800 tabular-nums">{stat.roundsResolved.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Completion</p>
          <p className="font-semibold tabular-nums" style={{ color }}>{completionPct}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Rounds completed</span>
          <span>{stat.roundsResolved} / {stat.roundsCreated}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Win Rate Badge ───────────────────────────────────────────────────────────
function WinBadge({ joined, won }: { joined: number; won: number }) {
  const pct = joined > 0 ? (won / joined) * 100 : 0
  const label = `${pct.toFixed(1)}%`
  if (pct >= 33) return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{label}</span>
  if (pct >= 16) return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{label}</span>
  return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{label}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DicePage() {
  const [data, setData] = useState<DiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/dice')
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
      setLastUpdated(new Date())
      setSecondsAgo(0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Update "X seconds ago" counter
  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 5000)
    return () => clearInterval(t)
  }, [lastUpdated])

  // Derived KPIs
  const totalRoundsResolved = data?.tierStats.reduce((s, t) => s + t.roundsResolved, 0) ?? 0
  const totalRoundsCreated  = data?.tierStats.reduce((s, t) => s + t.roundsCreated, 0) ?? 0
  const totalPayoutBig  = data?.tierStats.reduce((s, t) => s + BigInt(t.totalPayout), 0n) ?? 0n
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dice Game Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">On-chain stats from the AkibaDiceGame contract</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <p className="text-xs text-gray-400">
              Updated {secondsAgo < 10 ? 'just now' : `${secondsAgo}s ago`}
            </p>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            label="Rounds Played"
            value={totalRoundsResolved.toLocaleString()}
            sub={`${totalRoundsCreated.toLocaleString()} created`}
            icon={Dices}
            color="teal"
          />
          <KPICard
            label="Total Miles Paid Out"
            value={formatMiles(totalPayoutBig.toString())}
            sub="prize pool distributed"
            icon={Trophy}
            color="green"
          />
          <KPICard
            label="Total Rounds Created"
            value={totalRoundsCreated.toLocaleString()}
            sub="across all tiers"
            icon={BarChart2}
            color="violet"
          />
        </div>
      )}

      {/* Per-tier breakdown */}
      <div>
        <h2 className="mb-3 font-semibold text-gray-900">Per-Tier Breakdown</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0,1,2].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {(data?.tierStats ?? []).map(stat => <TierCard key={stat.tier} stat={stat} />)}
          </div>
        )}
      </div>

      {/* Subgraph banner if not configured */}
      {!loading && data && !data.subgraphAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <span className="font-semibold">Subgraph not configured.</span>{' '}
          Set <code className="rounded bg-amber-100 px-1 font-mono text-xs">GAMES_SUBGRAPH_URL</code> in your{' '}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs">.env</code> to enable daily active players and top winners charts.
        </div>
      )}

      {/* Daily Active Players */}
      {data?.subgraphAvailable && (
        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">Daily Active Players</h2>
            <p className="text-xs text-gray-400 mt-0.5">Unique wallets who joined at least one game per day (last 30 days)</p>
          </div>
          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          ) : !data.dailyActivePlayers.length ? (
            <p className="py-10 text-center text-sm text-gray-400">No game joins in the last 30 days</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.dailyActivePlayers} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={d => fmtDate(String(d))}
                  formatter={(v) => [Number(v).toLocaleString(), 'Unique Players']}
                />
                <Bar dataKey="count" fill={AKIBA_TEAL} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Top Winners */}
      {data?.subgraphAvailable && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Top 20 Winners</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ranked by total Miles won · from on-chain player stats</p>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />)}
            </div>
          ) : !data.topWinners.length ? (
            <p className="py-10 text-center text-sm text-gray-400">No player data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-gray-500">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium w-10">#</th>
                    <th className="py-3 px-4 text-left font-medium">Wallet</th>
                    <th className="py-3 px-4 text-right font-medium">Joined</th>
                    <th className="py-3 px-4 text-right font-medium">Won</th>
                    <th className="py-3 px-4 text-center font-medium">Win Rate</th>
                    <th className="py-3 px-4 text-right font-medium">Miles Won</th>
                    <th className="py-3 px-4 text-right font-medium">Miles Staked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topWinners.map((w, i) => (
                    <tr key={w.address} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-400 tabular-nums">{i + 1}</td>
                      <td className="py-3 px-4">
                        <a
                          href={`https://celoscan.io/address/${w.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-[#238D9D] hover:underline"
                        >
                          {shortAddr(w.address)}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-gray-700">{w.roundsJoined}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-gray-700">{w.roundsWon}</td>
                      <td className="py-3 px-4 text-center">
                        <WinBadge joined={w.roundsJoined} won={w.roundsWon} />
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-gray-800">
                        {formatMiles(w.totalWon)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-gray-600">
                        {formatMiles(w.totalStaked)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Game Streak Leaderboard */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Game Streak Leaderboard</h2>
          <p className="text-xs text-gray-400 mt-0.5">Top 50 wallets by current game streak</p>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />)}
          </div>
        ) : !(data?.gameStreaks.length) ? (
          <p className="py-10 text-center text-sm text-gray-400">No active game streaks found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-gray-500">
                <tr>
                  <th className="py-3 px-4 text-left font-medium w-10">#</th>
                  <th className="py-3 px-4 text-left font-medium">Wallet</th>
                  <th className="py-3 px-4 text-center font-medium">Current Streak</th>
                  <th className="py-3 px-4 text-center font-medium">Longest Streak</th>
                  <th className="py-3 px-4 text-left font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.gameStreaks.map((row, i) => {
                  const atRisk = row.last_scope_key !== null && row.last_scope_key < yesterday
                  return (
                    <tr key={row.user_address} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-400 tabular-nums">{i + 1}</td>
                      <td className="py-3 px-4">
                        <a
                          href={`https://celoscan.io/address/${row.user_address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-[#238D9D] hover:underline"
                        >
                          {shortAddr(row.user_address)}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#238D9D]/10 px-2.5 py-0.5 text-xs font-semibold text-[#238D9D]">
                          <Flame size={11} />
                          {row.current_streak}d
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-gray-600">{row.longest_streak}d</td>
                      <td className="py-3 px-4">
                        <span className={atRisk ? 'text-red-500 font-medium text-xs' : 'text-gray-500 text-xs'}>
                          {row.last_scope_key ?? '—'}
                          {atRisk && ' ⚠️'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
