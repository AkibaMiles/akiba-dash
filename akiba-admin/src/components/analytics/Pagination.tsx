'use client'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t">
      <span>
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className={cn(
            'px-3 py-1 rounded-md border text-xs font-medium',
            page === 1
              ? 'opacity-40 cursor-not-allowed bg-gray-50'
              : 'hover:bg-gray-100 bg-white',
          )}
        >
          ←
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.min(Math.max(page - 2, 1) + i, totalPages)
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={cn(
                'px-3 py-1 rounded-md border text-xs font-medium',
                p === page
                  ? 'bg-[#238D9D] text-white border-[#238D9D]'
                  : 'hover:bg-gray-100 bg-white',
              )}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className={cn(
            'px-3 py-1 rounded-md border text-xs font-medium',
            page === totalPages
              ? 'opacity-40 cursor-not-allowed bg-gray-50'
              : 'hover:bg-gray-100 bg-white',
          )}
        >
          →
        </button>
      </div>
    </div>
  )
}
