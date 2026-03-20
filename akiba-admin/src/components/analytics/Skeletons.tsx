export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-gray-100"
      style={{ height }}
    />
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-9 rounded bg-gray-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-gray-50" />
      ))}
    </div>
  )
}
