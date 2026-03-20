'use client'
import { useState, useCallback, useRef } from 'react'
import { useAnalyticsQuery } from '@/hooks/useAnalyticsQuery'
import { WalletAddress } from '@/components/analytics/WalletAddress'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { TableSkeleton } from '@/components/analytics/Skeletons'
import { Pagination } from '@/components/analytics/Pagination'
import { Download, Search, ChevronUp, ChevronDown, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const today = new Date().toISOString().split('T')[0]

interface PassHolder {
  address: string
  claimedAt: string
  referrer: string | null
  totalQuestClaims: number
  streak10: number
  streak30: number
}

interface PassHoldersData {
  data: PassHolder[]
  total: number
}

type SortKey = 'claimedAt' | 'totalQuestClaims' | 'streak10' | 'streak30'

function StreakBadge({ value, color }: { value: number; color: 'green' | 'teal' }) {
  if (value === 0) return <span className="text-gray-300 tabular-nums">—</span>
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
      color === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#238D9D]/10 text-[#238D9D]',
    )}>
      <Flame size={10} />
      {value}
    </span>
  )
}

export default function PassHoldersPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('claimedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (val: string) => {
    setSearch(val)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 350)
  }

  const { data, loading } = useAnalyticsQuery<PassHoldersData>('/api/analytics/pass-holders', {
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch || undefined,
    page,
    pageSize: 20,
    sortBy,
    sortDir,
  })

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  function downloadCSV() {
    if (!data?.data.length) return
    const header = 'Address,Claimed At,Referrer,Total Quest Claims,$10 Streak,$30 Streak'
    const rows = data.data.map(r =>
      [r.address, r.claimedAt, r.referrer ?? '', r.totalQuestClaims, r.streak10, r.streak30].join(','),
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pass-holders-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex flex-col opacity-40 group-hover:opacity-100">
      <ChevronUp size={10} className={sortBy === col && sortDir === 'asc' ? 'opacity-100 text-[#238D9D]' : ''} />
      <ChevronDown size={10} className={sortBy === col && sortDir === 'desc' ? 'opacity-100 text-[#238D9D]' : ''} />
    </span>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pass Holders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data ? `${data.total.toLocaleString()} total pass holders` : 'All Prosperity Pass claimants'}
          </p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={!data?.data.length}
          className="inline-flex items-center gap-2 rounded-lg bg-[#238D9D] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1d7a89] disabled:opacity-40 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 border p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by wallet address…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="rounded-lg border bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#238D9D] w-60"
          />
        </div>
        <div className="h-5 w-px bg-gray-200 hidden sm:block" />
        <DateRangePicker
          from={from || '2024-01-01'}
          to={to || today}
          onChange={(f, t) => { setFrom(f); setTo(t); setPage(1) }}
        />
        {(from || to || search) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setSearch(''); setDebouncedSearch(''); setPage(1) }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Wallet</th>
                <th
                  className="px-4 py-3 text-left font-semibold group cursor-pointer select-none hover:text-gray-800"
                  onClick={() => toggleSort('claimedAt')}
                >
                  <span className="inline-flex items-center">Claimed At <SortIcon col="claimedAt" /></span>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Referrer</th>
                <th
                  className="px-4 py-3 text-right font-semibold group cursor-pointer select-none hover:text-gray-800"
                  onClick={() => toggleSort('totalQuestClaims')}
                >
                  <span className="inline-flex items-center justify-end w-full">Quest Claims <SortIcon col="totalQuestClaims" /></span>
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold group cursor-pointer select-none hover:text-gray-800"
                  onClick={() => toggleSort('streak10')}
                >
                  <span className="inline-flex items-center justify-end w-full">$10 Streak <SortIcon col="streak10" /></span>
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold group cursor-pointer select-none hover:text-gray-800"
                  onClick={() => toggleSort('streak30')}
                >
                  <span className="inline-flex items-center justify-end w-full">$30 Streak <SortIcon col="streak30" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    No pass holders match the current filters
                  </td>
                </tr>
              ) : (
                data?.data.map(row => (
                  <tr key={row.address} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <WalletAddress address={row.address} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs tabular-nums">
                      {new Date(row.claimedAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.referrer
                        ? <WalletAddress address={row.referrer} />
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-gray-700">
                      {row.totalQuestClaims.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <StreakBadge value={row.streak10} color="green" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <StreakBadge value={row.streak30} color="teal" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onPage={p => setPage(p)} />
    </div>
  )
}
