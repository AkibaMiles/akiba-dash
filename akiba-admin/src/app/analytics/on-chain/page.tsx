'use client'
import { useState } from 'react'
import { useAnalyticsQuery } from '@/hooks/useAnalyticsQuery'
import { KPICard } from '@/components/analytics/KPICard'
import { ChartSkeleton } from '@/components/analytics/Skeletons'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AKIBA_TEAL } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  Flame, RotateCcw, Clock, ExternalLink,
  PiggyBank, Zap, Ticket, DollarSign, Coins, Activity, Dice5,
} from 'lucide-react'

interface SavingsTier {
  questId: string
  label: string
  activeHolders: number
  totalClaims: number
  uniqueWallets: number
}

interface TxQuest {
  questId: string
  label: string
  totalClaims: number
  uniqueWallets: number
}

interface DiceTier {
  tier: number
  roundsCreated: number
  roundsResolved: number
  totalStaked: number
  totalPayout: number
}

interface OnChainData {
  savings: SavingsTier[]
  txActivity: TxQuest[]
  summary: { totalQuestClaims: number; totalSavers: number; estimatedTotalTxns: number }
  passport: { totalBurned: number; refundCount: number; pendingQueue: number }
  raffle: {
    totalRounds: number
    totalUSDT: number
    totalAKIBA: number
    totalPointsSpent: number
    totalParticipations: number
    usdtRounds: number
    akibaRounds: number
    usdtParticipations: number
    akibaParticipations: number
  }
  dice: DiceTier[]
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

const PERIODS = [
  { label: 'Today',    days: 1 },
  { label: '7d',       days: 7 },
  { label: '30d',      days: 30 },
  { label: '90d',      days: 90 },
  { label: 'All time', days: null },
] as const

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export default function OnChainPage() {
  const [activePeriod, setActivePeriod] = useState<number | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const from = activePeriod !== null ? daysAgo(activePeriod) : undefined

  const { data, loading } = useAnalyticsQuery<OnChainData>('/api/analytics/on-chain', {
    ...(from ? { from, to: today } : {}),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">On-Chain Activity</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Savings behaviour, transaction quests, raffle participation, and passport ops
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setActivePeriod(p.days)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activePeriod === p.days
                  ? 'bg-[#238D9D] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard
          title="Est. On-Chain Txns"
          value={data?.summary.estimatedTotalTxns ? fmtNum(data.summary.estimatedTotalTxns) : '—'}
          subtitle="quests + raffle"
          icon={Zap}
          color="teal"
          loading={loading}
        />
        <KPICard
          title="Quest Claims"
          value={data?.summary.totalQuestClaims.toLocaleString() ?? '—'}
          subtitle="all quests incl. check-in"
          icon={Activity}
          color="amber"
          loading={loading}
        />
        <KPICard
          title="Active Savers"
          value={data?.summary.totalSavers.toLocaleString() ?? '—'}
          subtitle="$10 + $30 + $100"
          icon={PiggyBank}
          color="green"
          loading={loading}
        />
        <KPICard
          title="Raffle Participations"
          value={data?.raffle.totalParticipations.toLocaleString() ?? '—'}
          subtitle="across all rounds"
          icon={Ticket}
          color="violet"
          loading={loading}
        />
      </div>

      {/* Savings */}
      <Section title="Savings Behaviour" subtitle="Hold $10 / $30 / $100 on MiniPay — daily streak quests">
        {loading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-lg" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(data?.savings ?? []).map(tier => (
              <div key={tier.questId} className="rounded-lg border p-4 space-y-3">
                <p className="font-semibold text-gray-800">{tier.label}</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Active holders</span>
                    <span className="font-semibold text-emerald-600">{tier.activeHolders.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total claims</span>
                    <span className="font-medium text-gray-800">{tier.totalClaims.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unique wallets</span>
                    <span className="font-medium text-gray-800">{tier.uniqueWallets.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Transaction Activity */}
      <Section title="Transaction Quest Activity" subtitle="All-time claims for on-chain transaction quests">
        {loading ? (
          <ChartSkeleton />
        ) : !data?.txActivity.length ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.txActivity.length * 44)}>
            <BarChart
              data={data.txActivity}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtNum}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                tick={{ fontSize: 11, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [
                  Number(v).toLocaleString(),
                  name === 'totalClaims' ? 'Total claims' : 'Unique wallets',
                ]}
              />
              <Bar dataKey="totalClaims"  fill={AKIBA_TEAL}  fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={24} name="totalClaims" />
              <Bar dataKey="uniqueWallets" fill="#7c3aed" fillOpacity={0.6}  radius={[0, 4, 4, 0]} maxBarSize={24} name="uniqueWallets" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Raffle */}
      <Section title="Raffle Participation" subtitle="On-chain raffle data from Dune — all-time">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KPICard
            title="Total Rounds"
            value={data?.raffle.totalRounds.toLocaleString() ?? '—'}
            subtitle={`${data?.raffle.usdtRounds ?? 0} USDT · ${data?.raffle.akibaRounds ?? 0} AKIBA`}
            icon={Ticket}
            color="violet"
            loading={loading}
          />
          <KPICard
            title="Total Participations"
            value={data?.raffle.totalParticipations.toLocaleString() ?? '—'}
            subtitle={`${data?.raffle.usdtParticipations.toLocaleString() ?? 0} USDT · ${data?.raffle.akibaParticipations.toLocaleString() ?? 0} AKIBA`}
            icon={Zap}
            color="teal"
            loading={loading}
          />
          <KPICard
            title="USDT Distributed"
            value={data?.raffle.totalUSDT ? `$${data.raffle.totalUSDT.toLocaleString()}` : '—'}
            icon={DollarSign}
            color="green"
            loading={loading}
          />
          <KPICard
            title="AKIBA Distributed"
            value={data?.raffle.totalAKIBA ? data.raffle.totalAKIBA.toLocaleString() : '—'}
            icon={Coins}
            color="amber"
            loading={loading}
          />
        </div>
      </Section>

      {/* Dice Game */}
      {(() => {
        const diceTiers = data?.dice ?? []
        const totalTxns = diceTiers.reduce((s, r) =>
          s + r.roundsResolved * 7 + (r.roundsCreated - r.roundsResolved) * 6, 0)
        const totalRounds = diceTiers.reduce((s, r) => s + r.roundsCreated, 0)
        return (
          <Section
            title="Dice Game"
            subtitle="Each resolved round = 6 joinTier + 1 draw (7 txns). In-progress rounds = 6 txns each."
          >
            {loading ? (
              <div className="h-24 animate-pulse bg-gray-100 rounded-lg" />
            ) : (
              <div className="space-y-4">
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <KPICard
                    title="Est. On-Chain Txns"
                    value={totalTxns.toLocaleString()}
                    subtitle="across all tiers"
                    icon={Dice5}
                    color="teal"
                    loading={loading}
                  />
                  <KPICard
                    title="Total Rounds"
                    value={totalRounds.toLocaleString()}
                    subtitle="created all-time"
                    icon={Zap}
                    color="violet"
                    loading={loading}
                  />
                  <KPICard
                    title="Total Staked (CELO)"
                    value={diceTiers.reduce((s, r) => s + r.totalStaked, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    subtitle="across all tiers"
                    icon={Coins}
                    color="amber"
                    loading={loading}
                  />
                </div>

                {/* Per-tier breakdown */}
                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Tier</th>
                        <th className="px-4 py-3 text-right">Rounds Created</th>
                        <th className="px-4 py-3 text-right">Rounds Resolved</th>
                        <th className="px-4 py-3 text-right">Est. Txns</th>
                        <th className="px-4 py-3 text-right">Total Staked (CELO)</th>
                        <th className="px-4 py-3 text-right">Total Payout (CELO)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {diceTiers.map(row => {
                        const estTxns = row.roundsResolved * 7 + (row.roundsCreated - row.roundsResolved) * 6
                        return (
                          <tr key={row.tier} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">
                              <span className="inline-flex items-center gap-2">
                                <Dice5 size={14} className="text-[#238D9D]" />
                                {row.tier} CELO
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.roundsCreated.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.roundsResolved.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#238D9D]">{estTxns.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.totalPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Section>
        )
      })()}

      {/* Passport Ops */}
      <Section title="Passport Operations" subtitle="Points burned to mint passes, refunds, and pending queue">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KPICard
            title="AkibaMiles Burned"
            value={data?.passport.totalBurned.toLocaleString() ?? '—'}
            subtitle="completed pass burns"
            icon={Flame}
            color="rose"
            loading={loading}
          />
          <KPICard
            title="Ops Refunded"
            value={data?.passport.refundCount.toLocaleString() ?? '—'}
            subtitle="completed refunds"
            icon={RotateCcw}
            color="violet"
            loading={loading}
          />
          <KPICard
            title="Pending Queue"
            value={data?.passport.pendingQueue.toLocaleString() ?? '—'}
            subtitle="mint_queue pending"
            icon={Clock}
            color="amber"
            loading={loading}
          />
        </div>
      </Section>

      {/* Dune embed */}
      <div className="rounded-xl border overflow-hidden shadow-sm">
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #238D9D 0%, #1a6d7a 100%)' }}
        >
          <div>
            <p className="font-semibold text-white">Dune Analytics — Akiba Miles</p>
            <p className="text-xs text-white/70 mt-0.5">
              On-chain transfer volumes, TVL, and token metrics
            </p>
          </div>
          <a
            href="https://dune.com/superchain_eco/akiba-miles"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition-colors"
          >
            Open in Dune <ExternalLink size={12} />
          </a>
        </div>
        <iframe
          src="https://dune.com/embeds/superchain_eco/akiba-miles"
          className="w-full border-0 block"
          style={{ height: '80vh', minHeight: 600 }}
          title="Akiba Miles Dune Dashboard"
          allowFullScreen
        />
      </div>
    </div>
  )
}
