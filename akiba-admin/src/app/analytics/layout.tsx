'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Sparkles, RefreshCw, Link2, Dices, ArrowLeft,
} from 'lucide-react'

const navItems = [
  { href: '/analytics',              label: 'Overview',      icon: LayoutDashboard, exact: true },
  { href: '/analytics/pass-holders', label: 'Pass Holders',  icon: Users },
  { href: '/analytics/quests',       label: 'Quests',        icon: Sparkles },
  { href: '/analytics/retention',    label: 'Retention',     icon: RefreshCw },
  { href: '/analytics/on-chain',     label: 'On-Chain',      icon: Link2 },
  { href: '/analytics/dice',         label: 'Dice Game',     icon: Dices },
]

function SidebarNav({ path }: { path: string }) {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-white min-h-[calc(100vh-56px)]">
      <div className="px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Analytics</p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#238D9D]/10 text-[#238D9D]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon
                  size={16}
                  className={active ? 'text-[#238D9D]' : 'text-gray-400'}
                />
                {label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#238D9D]" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto border-t px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Raffles
        </Link>
      </div>
    </aside>
  )
}

function MobileNav({ path }: { path: string }) {
  return (
    <div className="lg:hidden flex gap-1 overflow-x-auto border-b bg-white px-4 py-2 no-scrollbar">
      {navItems.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-[#238D9D]/10 text-[#238D9D]'
                : 'text-gray-500 hover:bg-gray-100',
            )}
          >
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4">
      <div className="flex gap-0 rounded-xl border bg-white shadow-sm overflow-hidden">
        <SidebarNav path={path} />
        <div className="flex-1 min-w-0">
          <MobileNav path={path} />
          <div className="p-6 lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
