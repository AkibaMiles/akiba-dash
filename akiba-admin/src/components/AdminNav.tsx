'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import ConnectButton from '@/components/ConnectButton'

const tabs = [
  { href: '/dashboard', label: 'Raffles' },
  { href: '/analytics', label: 'Analytics' },
]

export default function AdminNav() {
  const path = usePathname()
  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="shrink-0 px-3 py-3 text-sm font-bold text-gray-800 mr-2">
            Akiba Admin
          </span>
          {tabs.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                path.startsWith(t.href)
                  ? 'border-[#238D9D] text-[#238D9D]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
              )}
            >
              {t.label}
            </Link>
          ))}
          <div className="ml-auto shrink-0 py-2 pl-4">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  )
}
