'use client'
import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAnalyticsQuery } from '@/hooks/useAnalyticsQuery'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { ChartSkeleton } from '@/components/analytics/Skeletons'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { WalletAddress } from '@/components/analytics/WalletAddress'
import { AKIBA_TEAL } from '@/lib/constants'
import { X, Sparkles, Link2 } from 'lucide-react'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
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

// Calendar heatmap colours
function heatColor(count: number, max: number): string {
  if (count === 0) return '#f3f4f6'
  const intensity = Math.min(count / Math.max(max, 1), 1)
  const alpha = 0.15 + intensity * 0.85
  return `rgba(35,141,157,${alpha.toFixed(2)})`
}

interface QuestCard {
  id: string
  title: string
  description: string
  rewardPoints: number
  totalClaims: number
  uniqueClaimers: number
  periodClaims: number
  isPartner: boolean
}

interface DrillDown {
  dailyClaims: { date: string; count: number }[]
  topWallets: { address: string; count: number }[]
  streakDistribution: { bucket: string; count: number }[]
}

interface QuestsData {
  questCards: QuestCard[]
  heatmap: { date: string; count: number }[]
  drillDown?: DrillDown
  debug?: { totalQuests: number }
}

function Heatmap({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <EmptyChart message="No engagement data in the last 90 days" />
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const byDate = Object.fromEntries(data.map(d => [d.date, d.count]))

  const todayDate = new Date()
  const days: { date: string; count: number }[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push({ date: key, count: byDate[key] ?? 0 })
  }

  const startDow = new Date(days[0].date).getDay()
  const cells = [...Array(startDow).fill(null), ...days]
  const weeks: (typeof days[0] | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" style={{ minWidth: weeks.length * 19 }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) =>
              day ? (
                <div
                  key={day.date}
                  title={`${fmtDate(day.date)}: ${day.count.toLocaleString()} claims`}
                  className="h-[15px] w-[15px] rounded-[3px] cursor-default transition-transform hover:scale-125"
                  style={{ backgroundColor: heatColor(day.count, maxCount) }}
                />
              ) : (
                <div key={di} className="h-[15px] w-[15px]" />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
        <span>Less</span>
        {[0, 0.2, 0.4, 0.7, 1].map((v, i) => (
          <div
            key={i}
            className="h-[12px] w-[12px] rounded-[2px]"
            style={{ backgroundColor: heatColor(v * maxCount, maxCount) }}
          />
        ))}
        <span>More</span>
        <span className="ml-2 text-gray-300">·</span>
        <span className="ml-1">Max: {maxCount.toLocaleString()} claims/day</span>
      </div>
    </div>
  )
}

export default function QuestsPage() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today)
  const [selectedQuest, setSelectedQuest] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data, loading, error } = useAnalyticsQuery<QuestsData>('/api/analytics/quests', {
    from,
    to,
    questId: selectedQuest ?? undefined,
  })

  const maxClaims = Math.max(...(data?.questCards.map(q => q.totalClaims) ?? [1]))

  const filteredCards = (data?.questCards ?? []).filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quest Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Performance of all active quests</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            placeholder="Search quests…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#238D9D]/30 w-48"
          />
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-semibold">API error:</span> {error}
        </div>
      )}

      {/* Quest cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100 border" />
          ))}
        </div>
      ) : !data?.questCards.length ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          No active quests found
          {data?.debug && (
            <p className="mt-2 text-xs text-amber-500">
              ({data.debug.totalQuests} total quests in DB — none have is_active=true)
            </p>
          )}
        </div>
      ) : (
        <>
          {filteredCards.length === 0 && search && (
            <p className="text-sm text-gray-400 py-4">No quests match &ldquo;{search}&rdquo;</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map(q => {
              const isSelected = selectedQuest === q.id
              const barWidth = maxClaims > 0 ? (q.totalClaims / maxClaims) * 100 : 0
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuest(isSelected ? null : q.id)}
                  className={`rounded-xl border p-4 text-left transition-all bg-white ${
                    isSelected
                      ? 'border-[#238D9D] shadow-md ring-2 ring-[#238D9D]/10'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-2 mb-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${q.isPartner ? 'bg-violet-50' : 'bg-[#238D9D]/10'}`}>
                      {q.isPartner
                        ? <Link2 size={14} className="text-violet-500" />
                        : <Sparkles size={14} className="text-[#238D9D]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{q.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {q.isPartner && (
                          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">Partner</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#238D9D]/10 px-2 py-0.5 text-xs font-medium text-[#238D9D]">
                      {q.rewardPoints}pts
                    </span>
                  </div>

                  {/* Period claims — prominent */}
                  <div className="mb-3">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{q.periodClaims.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">claims in period</p>
                  </div>

                  {/* Secondary stats */}
                  <div className="flex gap-4 text-xs mb-3">
                    <div>
                      <p className="font-semibold text-gray-600 tabular-nums">{q.totalClaims.toLocaleString()}</p>
                      <p className="text-gray-400">all-time</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600 tabular-nums">{q.uniqueClaimers.toLocaleString()}</p>
                      <p className="text-gray-400">unique wallets</p>
                    </div>
                  </div>

                  {/* Progress bar — relative to top quest */}
                  <div className="h-1 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: AKIBA_TEAL }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Drill-down panel */}
      {selectedQuest && data?.drillDown && (
        <div className="rounded-xl border border-[#238D9D]/20 bg-gradient-to-br from-[#238D9D]/5 to-transparent p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                {data.questCards.find(q => q.id === selectedQuest)?.title}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Drill-down · {from} → {to}</p>
            </div>
            <button
              onClick={() => setSelectedQuest(null)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Daily claims chart */}
            <div className="rounded-xl border bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-gray-700">Daily Claims</p>
              {!data.drillDown.dailyClaims.length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.drillDown.dailyClaims} barCategoryGap="30%">
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
                      domain={[0, 'auto']}
                      width={24}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(d) => fmtDate(String(d))}
                      formatter={(v) => [Number(v).toLocaleString(), 'Claims']}
                    />
                    <Bar dataKey="count" fill={AKIBA_TEAL} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top wallets */}
            <div className="rounded-xl border bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-gray-700">Top 10 Wallets</p>
              {!data.drillDown.topWallets.length ? (
                <p className="text-xs text-gray-400">No data</p>
              ) : (
                <div className="space-y-2">
                  {data.drillDown.topWallets.map((w, i) => (
                    <div key={w.address} className="flex items-center gap-2 text-sm">
                      <span className="shrink-0 w-4 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <WalletAddress address={w.address} />
                      </div>
                      <span className="tabular-nums text-xs font-semibold text-gray-700">{w.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Streak distribution */}
            <div className="rounded-xl border bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-gray-700">Streak Distribution</p>
              {!data.drillDown.streakDistribution.some(s => s.count > 0) ? (
                <p className="text-xs text-gray-400">No streak data for this quest</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.drillDown.streakDistribution} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 'auto']}
                      width={24}
                      tickFormatter={fmtNum}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v) => [Number(v).toLocaleString(), 'Wallets']}
                    />
                    <Bar dataKey="count" fill={AKIBA_TEAL} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="rounded-xl border bg-white p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900">Engagement Heatmap</h2>
          <p className="text-xs text-gray-400 mt-0.5">Total quest claims per day over the last 90 days</p>
        </div>
        {loading ? <ChartSkeleton height={120} /> : <Heatmap data={data?.heatmap ?? []} />}
      </div>
    </div>
  )
}
