'use client';

import { useEffect, useState } from 'react';

type PastRaffle = {
  roundId: number;
  start: number;
  end: number;
  durationSec: number;
  rewardToken: `0x${string}`;
  symbol: string;
  rewardPool: string;
  winner: string | null;
  winnerReward: string | null;
  winnerTs: number | null;
  totalTickets?: number;
  maxTickets?: number;
};

export default function PastRafflesPage() {
  const [data, setData] = useState<PastRaffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/past-raffles')
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json.raffles || []);
      })
      .catch(e => setErr(e.message || 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  const shorten = (addr: string | null) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—';

  const fmtDur = (sec: number) => {
    const d = Math.floor(sec / 86400);
    sec -= d * 86400;
    const h = Math.floor(sec / 3600);
    sec -= h * 3600;
    const m = Math.floor(sec / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b">
        <p className="font-semibold text-gray-900">Previous Raffles (v3)</p>
        <p className="text-xs text-gray-400 mt-0.5">Completed raffle rounds from the API</p>
      </div>

      {loading ? (
        <div className="p-5 space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />)}
        </div>
      ) : err ? (
        <p className="p-5 text-sm text-red-500">{err}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-500">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Round</th>
                <th className="text-left py-3 px-4 font-medium">Token</th>
                <th className="text-left py-3 px-4 font-medium">Reward</th>
                <th className="text-left py-3 px-4 font-medium">Tickets</th>
                <th className="text-left py-3 px-4 font-medium">Duration</th>
                <th className="text-left py-3 px-4 font-medium">Winner</th>
                <th className="text-left py-3 px-4 font-medium">Won</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400 text-sm">No past raffles found.</td></tr>
              ) : data.map(r => (
                <tr key={r.roundId} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">#{r.roundId}</td>
                  <td className="py-3 px-4 text-gray-600">{r.symbol}</td>
                  <td className="py-3 px-4 tabular-nums text-gray-800">{r.rewardPool} {r.symbol}</td>
                  <td className="py-3 px-4 tabular-nums text-gray-600">
                    {typeof r.totalTickets === 'number' && typeof r.maxTickets === 'number'
                      ? `${r.totalTickets}/${r.maxTickets}`
                      : typeof r.totalTickets === 'number' ? `${r.totalTickets}/?` : '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{fmtDur(r.durationSec)}</td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-600">{shorten(r.winner)}</td>
                  <td className="py-3 px-4 tabular-nums text-gray-600">
                    {r.winnerReward ? `${r.winnerReward} ${r.symbol}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-3 text-xs">
                      <a className="text-[#238D9D] hover:underline" href={`https://celoscan.io/address/${r.rewardToken}`} target="_blank" rel="noreferrer">Token</a>
                      {r.winner && <a className="text-[#238D9D] hover:underline" href={`https://celoscan.io/address/${r.winner}`} target="_blank" rel="noreferrer">Winner</a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
