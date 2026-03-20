export function EmptyChart({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
      {message}
    </div>
  )
}
