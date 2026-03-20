'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export function useAnalyticsQuery<T>(
  url: string,
  params: Record<string, string | number | undefined> = {},
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) sp.set(k, String(v))
      }
      const res = await fetch(`${url}?${sp}`, { signal: controller.signal })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey])

  useEffect(() => {
    fetchData()
    return () => abortRef.current?.abort()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
