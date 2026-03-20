'use client'
import { useAnalyticsQuery } from '@/hooks/useAnalyticsQuery'
import { KPICard } from '@/components/analytics/KPICard'
import { Flame, RotateCcw, Clock, ExternalLink } from 'lucide-react'

interface OnChainData {
  totalBurned: number
  refundCount: number
  pendingQueue: number
}

export default function OnChainPage() {
  const { data, loading } = useAnalyticsQuery<OnChainData>('/api/analytics/on-chain', {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">On-Chain</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Off-chain Supabase bridge stats + on-chain transfer volumes from Dune
        </p>
      </div>

      {/* Bridge stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard
          title="AkibaMiles Burned"
          value={data ? data.totalBurned.toLocaleString() : '—'}
          subtitle="completed pass burns"
          icon={Flame}
          color="rose"
          loading={loading}
        />
        <KPICard
          title="Ops Refunded"
          value={data ? data.refundCount.toLocaleString() : '—'}
          subtitle="completed refunds"
          icon={RotateCcw}
          color="violet"
          loading={loading}
        />
        <KPICard
          title="Pending Queue"
          value={data ? data.pendingQueue.toLocaleString() : '—'}
          subtitle="mint_queue pending"
          icon={Clock}
          color="amber"
          loading={loading}
        />
      </div>

      {/* Dune embed */}
      <div className="rounded-xl border overflow-hidden shadow-sm">
        {/* Banner */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #238D9D 0%, #1a6d7a 100%)' }}
        >
          <div>
            <p className="font-semibold text-white">Dune Analytics — Akiba Miles</p>
            <p className="text-xs text-white/70 mt-0.5">
              On-chain transfer volumes, TVL, and token metrics from Superchain Eco
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
