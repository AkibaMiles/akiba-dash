'use client'
import { useState } from 'react'
import { useAnalyticsQuery } from '@/hooks/useAnalyticsQuery'
import { WalletAddress } from '@/components/analytics/WalletAddress'
import { TableSkeleton, ChartSkeleton } from '@/components/analytics/Skeletons'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { cn } from '@/lib/utils'
import { AKIBA_TEAL } from '@/lib/constants'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface FunnelStep { step: string; count: number }
interface CohortRow { cohortWeek: string; size: number; retention: (number | null)[] }
interface StreakRow {
  address: string; questId: string; scope: string
  currentStreak: number; longestStreak: number; lastScopeKey: string; broken: boolean
}
interface RetentionData {
  funnel: FunnelStep[]
  cohortTable: CohortRow[]
  streakHealth: StreakRow[]
}

function retentionBg(pct: number) {
  if (pct >= 50) return 'bg-emerald-100 text-emerald-800'
  if (pct >= 20) return 'bg-amber-100 text-amber-800'
  if (pct > 0)   return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-400'
}

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.count || 1
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = (step.count / max) * 100
        const drop = i > 0 ? ((steps[i - 1].count - step.count) / Math.max(steps[i - 1].count, 1)) * 100 : null
        return (
          <div key={i} className="flex items-center gap-4">
            {/* Label */}
            <div className="w-52 shrink-0 text-right">
              <p className="text-sm font-medium text-gray-700 truncate">{step.step}</p>
              {drop !== null && drop > 0 && (
                <p className="text-xs text-red-400">↓ {drop.toFixed(1)}% drop</p>
              )}
            </div>
            {/* Bar */}
            <div className="flex-1 h-8 rounded-lg bg-gray-100 relative overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: AKIBA_TEAL, opacity: 0.75 + (pct / 400) }}
              />
              <span className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-white mix-blend-overlay pointer-events-none">
                {pct.toFixed(0)}%
              </span>
            </div>
            {/* Count */}
            <div className="w-28 shrink-0 text-sm font-bold text-gray-900 tabular-nums">
              {step.count.toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

type StreakSort = 'currentStreak' | 'longestStreak' | 'lastScopeKey'

export default function RetentionPage() {
  const { data, loading } = useAnalyticsQuery<RetentionData>('/api/analytics/retention', {})
  const [streakSort, setStreakSort] = useState<StreakSort>('currentStreak')
  const [streakDir, setStreakDir] = useState<'asc' | 'desc'>('desc')
  const NUM_WEEKS = 9

  function toggleStreakSort(col: StreakSort) {
    if (streakSort === col) setStreakDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setStreakSort(col); setStreakDir('desc') }
  }

  const sortedStreaks = [...(data?.streakHealth ?? [])].sort((a, b) => {
    const av = a[streakSort] as number | string
    const bv = b[streakSort] as number | string
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return streakDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ col }: { col: StreakSort }) => (
    <span className="ml-1 inline-flex flex-col opacity-40 group-hover:opacity-100">
      <ChevronUp size={10} className={streakSort === col && streakDir === 'asc' ? 'opacity-100 text-[#238D9D]' : ''} />
      <ChevronDown size={10} className={streakSort === col && streakDir === 'desc' ? 'opacity-100 text-[#238D9D]' : ''} />
    </span>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Retention</h1>
        <p className="text-sm text-gray-400 mt-0.5">Cohort analysis, engagement funnel, and streak health</p>
      </div>

      {/* Funnel */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-5">
          <h2 className="font-semibold text-gray-900">Balance Holder Funnel</h2>
          <p className="text-xs text-gray-400 mt-0.5">From wallet registration to active balance streak</p>
        </div>
        {loading ? (
          <ChartSkeleton height={220} />
        ) : !data?.funnel.length ? (
          <EmptyChart />
        ) : (
          <FunnelChart steps={data.funnel} />
        )}
      </div>

      {/* Cohort table */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900">Wallet Cohort Retention</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Each row = week of first engagement. Columns show % of that cohort that returned in week N.
          </p>
          <div className="mt-2 flex gap-3 text-xs">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-100" /> ≥ 50%</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-100" /> 20–50%</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-100" /> &lt; 20%</span>
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={8} />
        ) : !data?.cohortTable.length ? (
          <EmptyChart message="Not enough engagement history for cohort analysis" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-xs font-semibold text-gray-500">
                <tr>
                  <th className="pb-2 pr-4 text-left whitespace-nowrap">Cohort Week</th>
                  <th className="pb-2 px-3 text-right whitespace-nowrap">Size</th>
                  {Array.from({ length: NUM_WEEKS }, (_, i) => (
                    <th key={i} className="pb-2 px-2 text-center whitespace-nowrap">Wk {i}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.cohortTable.map(row => (
                  <tr key={row.cohortWeek} className="hover:bg-gray-50/50">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">{row.cohortWeek}</td>
                    <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold text-gray-700">{row.size}</td>
                    {row.retention.slice(0, NUM_WEEKS).map((pct, wi) => (
                      <td key={wi} className="py-2 px-2 text-center">
                        {pct === null ? (
                          <span className="text-gray-200 text-xs">—</span>
                        ) : (
                          <span className={cn(
                            'inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                            wi === 0 ? 'bg-[#238D9D]/10 text-[#238D9D]' : retentionBg(pct),
                          )}>
                            {pct}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Streak Health */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900">Streak Health</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Top 200 streaks. <span className="text-red-400 font-medium">Broken</span> = last activity before yesterday.
          </p>
        </div>
        {loading ? (
          <TableSkeleton rows={10} />
        ) : !data?.streakHealth.length ? (
          <p className="text-sm text-gray-400">No streak data available.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Wallet</th>
                  <th className="px-4 py-3 text-left">Scope</th>
                  <th
                    className="px-4 py-3 text-right cursor-pointer select-none group hover:text-gray-700"
                    onClick={() => toggleStreakSort('currentStreak')}
                  >
                    <span className="inline-flex items-center justify-end">Current <SortIcon col="currentStreak" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-right cursor-pointer select-none group hover:text-gray-700"
                    onClick={() => toggleStreakSort('longestStreak')}
                  >
                    <span className="inline-flex items-center justify-end">Longest <SortIcon col="longestStreak" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none group hover:text-gray-700"
                    onClick={() => toggleStreakSort('lastScopeKey')}
                  >
                    <span className="inline-flex items-center">Last Activity <SortIcon col="lastScopeKey" /></span>
                  </th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStreaks.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <WalletAddress address={row.address} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{row.scope}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{row.currentStreak}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{row.longestStreak}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.lastScopeKey}</td>
                    <td className="px-4 py-3">
                      {row.broken ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                          Broken
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
