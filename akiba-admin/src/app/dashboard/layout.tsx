'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard', label: 'Create', exact: true },
  { href: '/dashboard/random', label: 'Random VRF' },
  { href: '/dashboard/draw', label: 'Draw / Close' },
  { href: '/dashboard/past-raffles', label: 'Past Raffles v3', exact: true },
  { href: '/dashboard/past-raffles-v2', label: 'Past Raffles V2' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* Sub-navigation */}
      <div className="flex gap-0 overflow-x-auto no-scrollbar border-b">
        {TABS.map(t => {
          const active = t.exact ? path === t.href : path.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                active
                  ? 'border-[#238D9D] text-[#238D9D]'
                  : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
