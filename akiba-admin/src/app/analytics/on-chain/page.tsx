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
  tierAmount: number
  activeHolders: number
  totalClaims: number
  uniqueWallets: number
}

interface KilnData {
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
  minTransferPerClaim: number | null
  estimatedMinTransferred: number
}

interface DiceTier {
  tier: number
  roundsCreated: number
  roundsResolved: number
  totalStaked: number
  totalPayout: number
}

interface TopHolder { address: string; balance: number }
interface TopSaver {
  address: string
  balance: number
  tiers: string[]
  milestone50: boolean
  milestone100: boolean
  uniqueClaimDays: number
  totalClaims: number
}

interface HoldingsStat {
  questId: string
  walletCount: number
  totalHeld: number
  avgHeld: number
}

interface HoldingsData {
  savings:    HoldingsStat[]
  topSavers:  TopSaver[]
  kiln: { walletCount: number; totalHeld: number; avgHeld: number; topHolders: TopHolder[] }
}

interface OnChainData {
  savings: SavingsTier[]
  kiln: KilnData
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

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
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
  const totalEstimatedMinTransferred = (data?.txActivity ?? []).reduce(
    (sum, quest) => sum + (quest.estimatedMinTransferred ?? 0),
    0,
  )

  const { data: holdings, loading: holdingsLoading } = useAnalyticsQuery<HoldingsData>(
    '/api/analytics/on-chain/holdings', {},
  )

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
        {/* Total actual TVL banner */}
        {!holdingsLoading && holdings && (
          <div className="flex items-center justify-between rounded-lg bg-violet-50 border border-violet-100 px-4 py-3">
            <div>
              <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Total Actual TVL</p>
              <p className="text-2xl font-bold text-violet-700 mt-0.5">
                {fmtUSD(holdings.savings.reduce((s, h) => s + h.totalHeld, 0))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-violet-400">across all savings tiers</p>
              <p className="text-xs text-violet-400 mt-0.5">
                {(data?.savings ?? []).reduce((s, t) => s + t.activeHolders, 0).toLocaleString()} active holders
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-lg" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(data?.savings ?? []).map(tier => {
              const h = holdings?.savings.find(s => s.questId === tier.questId)
              const multiplier = h && tier.tierAmount > 0
                ? (h.avgHeld / tier.tierAmount).toFixed(1)
                : null
              return (
                <div key={tier.questId} className="rounded-lg border p-4 space-y-3">
                  <p className="font-semibold text-gray-800">{tier.label}</p>
                  <div className="space-y-1.5 text-sm">
                    {/* Actual holdings — lead */}
                    <div className="flex justify-between items-baseline">
                      <span className="text-gray-500">Actual held</span>
                      <span className={`font-bold text-base ${holdingsLoading ? 'text-gray-300' : 'text-violet-600'}`}>
                        {holdingsLoading ? '...' : h ? fmtUSD(h.totalHeld) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Avg per holder</span>
                      <span className="flex items-center gap-1.5">
                        <span className={`font-medium ${holdingsLoading ? 'text-gray-300' : 'text-gray-800'}`}>
                          {holdingsLoading ? '...' : h ? fmtUSD(h.avgHeld) : '—'}
                        </span>
                        {multiplier && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {multiplier}× min
                          </span>
                        )}
                      </span>
                    </div>
                    {/* Quest stats — secondary */}
                    <div className="border-t pt-1.5 mt-1 space-y-1.5 text-gray-500">
                      <div className="flex justify-between">
                        <span>Active holders</span>
                        <span className="font-medium text-emerald-600">{tier.activeHolders.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total claims</span>
                        <span className="font-medium text-gray-700">{tier.totalClaims.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Min. TVL</span>
                        <span className="font-medium text-gray-700">${(tier.activeHolders * tier.tierAmount).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Unified top savers table */}
        {!holdingsLoading && holdings?.topSavers && holdings.topSavers.length > 0 && (
          <div className="overflow-x-auto rounded-xl border mt-2">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left w-8">#</th>
                  <th className="px-4 py-2.5 text-left">Wallet</th>
                  <th className="px-4 py-2.5 text-left">Tiers</th>
                  <th className="px-4 py-2.5 text-right">Claim days</th>
                  <th className="px-4 py-2.5 text-right">Total claims</th>
                  <th className="px-4 py-2.5 text-right">Total held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holdings.topSavers.map((s, i) => (
                  <tr key={s.address} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://celoscan.io/address/${s.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-gray-600 hover:text-[#238D9D] transition-colors"
                        >
                          {shortAddr(s.address)}
                        </a>
                        {s.milestone100 && (
                          <span className="rounded-full bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">100</span>
                        )}
                        {s.milestone50 && !s.milestone100 && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">50</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {s.tiers.map(t => (
                          <span key={t} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{s.uniqueClaimDays.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">{s.totalClaims.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-semibold text-violet-600 tabular-nums">
                      {fmtUSD(s.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Kiln Finance */}
      <Section title="Kiln Finance" subtitle="Hold $10 in Kiln Finance — daily streak quest">
        {loading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-lg" />
        ) : (
          <div className="rounded-lg border p-4 space-y-3 max-w-xs">
            <p className="font-semibold text-gray-800">{data?.kiln.label ?? 'Hold $10 Kiln'}</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Unique claimers</span>
                <span className="font-semibold text-emerald-600">{(data?.kiln.uniqueWallets ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total claims</span>
                <span className="font-medium text-gray-800">{(data?.kiln.totalClaims ?? 0).toLocaleString()}</span>
              </div>
              <div className="border-t pt-1.5 mt-1.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Actual total staked</span>
                  <span className={`font-semibold ${holdingsLoading ? 'text-gray-300' : 'text-violet-600'}`}>
                    {holdingsLoading ? '...' : holdings?.kiln ? fmtUSD(holdings.kiln.totalHeld) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg per holder</span>
                  <span className={`font-medium ${holdingsLoading ? 'text-gray-300' : 'text-gray-800'}`}>
                    {holdingsLoading ? '...' : holdings?.kiln ? fmtUSD(holdings.kiln.avgHeld) : '—'}
                  </span>
                </div>
              </div>
              {holdings?.kiln.topHolders && holdings.kiln.topHolders.length > 0 && (
                <div className="border-t pt-2 mt-1">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Top holders</p>
                  <div className="space-y-1">
                    {holdings.kiln.topHolders.map((w, i) => (
                      <div key={w.address} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 w-4 shrink-0">{i + 1}.</span>
                        <a
                          href={`https://celoscan.io/address/${w.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-gray-500 hover:text-[#238D9D] transition-colors flex-1 px-1"
                        >
                          {shortAddr(w.address)}
                        </a>
                        <span className="font-semibold text-gray-700">{fmtUSD(w.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
          <>
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
            <div className="flex items-center justify-between rounded-lg bg-teal-50 border border-teal-100 px-4 py-2.5 text-sm">
              <span className="text-teal-700 font-medium">Total est. min. transferred</span>
              <span className="font-bold text-teal-800">${totalEstimatedMinTransferred.toLocaleString()}</span>
            </div>
          </>
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
      </div>
    </div>
  )
}
