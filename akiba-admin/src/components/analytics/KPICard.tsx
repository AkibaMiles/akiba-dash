'use client'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const colorMap = {
  teal:   { border: 'border-t-[#238D9D]', iconBg: 'bg-[#238D9D]/10', iconText: 'text-[#238D9D]' },
  violet: { border: 'border-t-violet-500', iconBg: 'bg-violet-50',    iconText: 'text-violet-600' },
  amber:  { border: 'border-t-amber-500',  iconBg: 'bg-amber-50',     iconText: 'text-amber-600'  },
  green:  { border: 'border-t-emerald-500',iconBg: 'bg-emerald-50',   iconText: 'text-emerald-600'},
  rose:   { border: 'border-t-rose-500',   iconBg: 'bg-rose-50',      iconText: 'text-rose-600'   },
  blue:   { border: 'border-t-blue-500',   iconBg: 'bg-blue-50',      iconText: 'text-blue-600'   },
}

interface KPICardProps {
  title: string
  value: string | number
  pctChange?: number | null
  subtitle?: string
  loading?: boolean
  icon?: LucideIcon
  color?: keyof typeof colorMap
}

export function KPICard({
  title, value, pctChange, subtitle, loading, icon: Icon, color = 'teal',
}: KPICardProps) {
  const c = colorMap[color]

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-t-4 bg-white p-5 shadow-sm animate-pulse', c.border)}>
        <div className="flex items-start justify-between mb-4">
          <div className="h-9 w-9 rounded-lg bg-gray-100" />
        </div>
        <div className="h-8 w-20 rounded bg-gray-100 mb-2" />
        <div className="h-3 w-28 rounded bg-gray-100" />
      </div>
    )
  }

  const up = pctChange !== null && pctChange !== undefined && pctChange >= 0
  const hasChange = pctChange !== null && pctChange !== undefined

  return (
    <div className={cn('rounded-xl border border-t-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md', c.border)}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', c.iconBg)}>
            <Icon size={18} className={c.iconText} />
          </div>
        )}
        {hasChange && (
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
            up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
          )}>
            {up ? '↑' : '↓'} {Math.abs(pctChange!).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-gray-500">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}
