'use client'
import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAnalyticsQuery } from '@/hooks/useAnalyticsQuery'
import { KPICard } from '@/components/analytics/KPICard'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { ChartSkeleton } from '@/components/analytics/Skeletons'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AKIBA_TEAL } from '@/lib/constants'
import { Award, Wallet, TrendingUp, Zap, Activity, Flame } from 'lucide-react'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

interface OverviewData {
  kpis: {
    passHolders: number
    totalWallets: number
    conversionRate: number
    questClaims: number
    activeWallets7d: number
    balanceStreakWallets: number
    changes: {
      passHolders: number | null
      totalWallets: number | null
      questClaims: number | null
      activeWallets7d: number | null
    }
  }
  passAdoption: { date: string; cumulative: number }[]
  weeklyActive: { week: string; count: number }[]
  questBreakdown: { questId: string; title: string; count: number }[]
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

function ChartCard({ title, subtitle, children, loading, empty }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  loading?: boolean
  empty?: boolean
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-4">
        <p className="font-semibold text-gray-900">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      {loading ? <ChartSkeleton /> : empty ? <EmptyChart /> : children}
    </div>
  )
}

export default function OverviewPage() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today)

  const { data, loading } = useAnalyticsQuery<OverviewData>('/api/analytics/overview', { from, to })
  const kpis = data?.kpis

  const avgWeeklyActive = data?.weeklyActive.length
    ? Math.round(data.weeklyActive.reduce((s, d) => s + d.count, 0) / data.weeklyActive.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-400 mt-0.5">All key metrics at a glance</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KPICard
          title="Pass Holders"
          value={kpis?.passHolders.toLocaleString() ?? '—'}
          pctChange={kpis?.changes.passHolders}
          icon={Award}
          color="teal"
          loading={loading}
        />
        <KPICard
          title="Registered Wallets"
          value={kpis?.totalWallets.toLocaleString() ?? '—'}
          pctChange={kpis?.changes.totalWallets}
          icon={Wallet}
          color="blue"
          loading={loading}
        />
        <KPICard
          title="Conversion Rate"
          value={kpis ? `${kpis.conversionRate.toFixed(1)}%` : '—'}
          subtitle="pass / wallet"
          icon={TrendingUp}
          color="violet"
          loading={loading}
        />
        <KPICard
          title="Quest Claims"
          value={kpis?.questClaims.toLocaleString() ?? '—'}
          pctChange={kpis?.changes.questClaims}
          subtitle="in period"
          icon={Zap}
          color="amber"
          loading={loading}
        />
        <KPICard
          title="Active Wallets (7d)"
          value={kpis?.activeWallets7d.toLocaleString() ?? '—'}
          pctChange={kpis?.changes.activeWallets7d}
          subtitle="vs prev 7d"
          icon={Activity}
          color="green"
          loading={loading}
        />
        <KPICard
          title="$10 Streak Wallets"
          value={kpis?.balanceStreakWallets.toLocaleString() ?? '—'}
          subtitle="active streak"
          icon={Flame}
          color="rose"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pass Adoption — area chart */}
        <ChartCard
          title="Pass Adoption"
          subtitle="Cumulative Prosperity Pass claims over time"
          loading={loading}
          empty={!data?.passAdoption.length}
        >
          <div className="overflow-x-auto">
            <ResponsiveContainer width="100%" height={240} minWidth={300}>
              <AreaChart data={data?.passAdoption} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AKIBA_TEAL} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={AKIBA_TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtNum}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                  width={36}
                />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(d) => fmtDate(String(d))}
                  formatter={(v) => [Number(v).toLocaleString(), 'Total passes']}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={AKIBA_TEAL}
                  strokeWidth={2.5}
                  fill="url(#gradTeal)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: AKIBA_TEAL }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Weekly Active Wallets — bar chart */}
        <ChartCard
          title="Weekly Active Wallets"
          subtitle={avgWeeklyActive > 0 ? `${avgWeeklyActive.toLocaleString()} avg/week in period` : 'Distinct wallets with any engagement per ISO week'}
          loading={loading}
          empty={!data?.weeklyActive.length}
        >
          <div className="overflow-x-auto">
            <ResponsiveContainer width="100%" height={240} minWidth={300}>
              <BarChart data={data?.weeklyActive} margin={{ top: 4, right: 50, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtNum}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                  width={36}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [Number(v).toLocaleString(), 'Unique wallets']}
                />
                {avgWeeklyActive > 0 && (
                  <ReferenceLine
                    y={avgWeeklyActive}
                    stroke={AKIBA_TEAL}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{ value: `Avg ${avgWeeklyActive}`, position: 'right', fontSize: 10, fill: AKIBA_TEAL }}
                  />
                )}
                <Bar dataKey="count" fill={AKIBA_TEAL} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Quest Breakdown */}
      <ChartCard
        title="Quest Claim Breakdown"
        subtitle="Claims per quest in the selected period"
        loading={loading}
        empty={!data?.questBreakdown.length}
      >
        <div className="overflow-x-auto">
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, (data?.questBreakdown.length ?? 5) * 40)}
            minWidth={300}
          >
            <BarChart
              data={data?.questBreakdown}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtNum}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 'auto']}
              />
              <YAxis
                type="category"
                dataKey="title"
                width={190}
                tick={{ fontSize: 11, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [Number(v).toLocaleString(), 'Claims']}
              />
              <Bar dataKey="count" fill={AKIBA_TEAL} fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}
