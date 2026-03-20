'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function WalletAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(address).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm">
      {truncate(address)}
      <button
        onClick={copy}
        className="text-gray-400 hover:text-gray-700 transition-colors"
        title="Copy address"
      >
        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      </button>
    </span>
  )
}
