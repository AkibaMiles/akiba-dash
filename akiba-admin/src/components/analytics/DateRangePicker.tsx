'use client'

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => onChange(daysAgo(p.days), today)}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            Last {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <input
          type="date"
          value={from}
          max={to}
          onChange={e => onChange(e.target.value, to)}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#238D9D]"
        />
        <span>–</span>
        <input
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={e => onChange(from, e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#238D9D]"
        />
      </div>
    </div>
  )
}
