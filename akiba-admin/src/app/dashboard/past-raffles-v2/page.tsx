// app/dashboard/past-raffles-v2/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { gqlFetch } from '@/lib/subgraph';

type RC = {
  id: string; roundId: string; startTime?: string; endTime?: string;
  rewardToken?: string | null; rewardPool?: string; maxTickets?: string;
  ticketCostPoints?: string; roundType?: number | null;
};
type WS  = { id: string; roundId: string; winner: string; reward: string };
type MWS = { id: string; roundId: string; winners: string[]; amounts: string[] };
type PJ  = { id: string; roundId: string; tickets: string };
type Gql = { roundCreateds: RC[]; winnerSelecteds: WS[]; multiWinnersSelecteds: MWS[]; participantJoineds: PJ[] };

const QUERY = /* GraphQL */ `
  query PastRaffles($first: Int!) {
    roundCreateds(first: $first, orderBy: roundId, orderDirection: desc) {
      id roundId startTime endTime rewardToken rewardPool maxTickets ticketCostPoints roundType
    }
    winnerSelecteds(first: $first, orderBy: roundId, orderDirection: desc) { id roundId winner reward }
    multiWinnersSelecteds(first: $first, orderBy: roundId, orderDirection: desc) { id roundId winners amounts }
    participantJoineds(first: 1000, orderBy: id, orderDirection: desc) { id roundId tickets }
  }
`;

const TOKENS = {
  usdt: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
  cusd: '0x765de816845861e75a25fca122bb6898b8b1282a',
  miles: '0xeed878017f027fe96316007d0ca5fda58ee93a6b',
} as const;

const SYMBOLS: Record<string, string> = {
  [TOKENS.usdt]: 'USDT', [TOKENS.cusd]: 'cUSD', [TOKENS.miles]: 'AkibaMiles',
};
const DECIMALS: Record<string, number> = {
  [TOKENS.usdt]: 6, [TOKENS.cusd]: 18, [TOKENS.miles]: 18,
};

const shortAddr = (a?: string) => (a && a.length > 12 ? `${a.slice(0,6)}…${a.slice(-4)}` : a || '—');

function formatUnits(raw?: string | null, decimals = 18): string {
  if (!raw) return '—';
  let s = BigInt(raw).toString();
  const neg = s.startsWith('-'); if (neg) s = s.slice(1);
  if (decimals === 0) return (neg ? '-' : '') + s;
  if (s.length <= decimals) s = '0'.repeat(decimals - s.length + 1) + s;
  const i = s.length - decimals;
  const whole = s.slice(0, i);
  const frac = s.slice(i).replace(/0+$/, '');
  const out = frac ? `${whole}.${frac}` : whole;
  return (neg ? '-' : '') + out.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtAmountWithSymbol(raw?: string, token?: string | null) {
  if (!token || token === '0x0000000000000000000000000000000000000000') return '—';
  const key = token.toLowerCase();
  return `${formatUnits(raw, DECIMALS[key] ?? 18)} ${SYMBOLS[key] || shortAddr(key)}`;
}

const typeLabel = (t?: number | null) => t === 3 ? 'Physical' : t === 2 ? 'Top-5' : t === 1 ? 'Top-3' : 'Single';
const typeBadgeColor = (t?: number | null) =>
  t === 3 ? 'bg-amber-50 text-amber-700' : t === 2 ? 'bg-purple-50 text-purple-700' :
  t === 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700';

const fmtDur = (s?: string, e?: string) => {
  const sec = Math.max(0, Number(e || 0) - Number(s || 0));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

type Row = {
  roundId: number; startTime?: string; endTime?: string;
  rewardToken?: string | null; rewardPool?: string;
  maxTickets?: number; totalTickets?: number; roundType?: number | null;
  winners: { addr: string; amount?: string }[];
};

export default function PastRafflesV2Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await gqlFetch<Gql>(QUERY, { first: 500 });
        const wmap = new Map<string, { addr: string; amount?: string }[]>();
        for (const e of d.winnerSelecteds || []) wmap.set(e.roundId, [{ addr: e.winner, amount: e.reward }]);
        for (const e of d.multiWinnersSelecteds || []) {
          const arr = (e.winners || []).map((w, i) => ({ addr: w, amount: e.amounts?.[i] }));
          if (arr.length) wmap.set(e.roundId, arr);
        }
        const tix = new Map<string, number>();
        for (const e of d.participantJoineds || []) {
          const n = Number(e.tickets || 0);
          tix.set(e.roundId, (tix.get(e.roundId) || 0) + (Number.isFinite(n) ? n : 0));
        }
        const now = Math.floor(Date.now() / 1000);
        const out: Row[] = [];
        for (const r of d.roundCreateds || []) {
          const end = Number(r.endTime || 0);
          if (!wmap.has(r.roundId) && !(end > 0 && now > end)) continue;
          const rt = Number(r.roundType ?? 0);
          out.push({
            roundId: Number(r.roundId), startTime: r.startTime, endTime: r.endTime,
            rewardToken: rt === 3 ? null : r.rewardToken, rewardPool: r.rewardPool,
            maxTickets: Number(r.maxTickets || 0) || undefined,
            totalTickets: tix.get(r.roundId) || 0,
            roundType: rt, winners: wmap.get(r.roundId) || [],
          });
        }
        setRows(out);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const view = useMemo(() => rows, [rows]);

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b">
        <p className="font-semibold text-gray-900">Previous Raffles (V2 Subgraph)</p>
        <p className="text-xs text-gray-400 mt-0.5">Historical rounds from the GraphQL subgraph</p>
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
                <th className="text-left py-3 px-4 font-medium">Type</th>
                <th className="text-left py-3 px-4 font-medium">Token</th>
                <th className="text-left py-3 px-4 font-medium">Reward</th>
                <th className="text-left py-3 px-4 font-medium">Duration</th>
                <th className="text-left py-3 px-4 font-medium">Winners</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {view.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400 text-sm">No past raffles found.</td></tr>
              ) : view.map((r) => {
                const isPhysical = r.roundType === 3;
                const token = (r.rewardToken || '').toLowerCase();
                const tokenLabel = isPhysical ? 'Physical' : (SYMBOLS[token] || shortAddr(token));
                const totalReward = isPhysical ? '—' : fmtAmountWithSymbol(r.rewardPool, token);
                return (
                  <tr key={r.roundId} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="py-3 px-4 font-medium text-gray-900">#{r.roundId}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeColor(r.roundType)}`}>
                        {typeLabel(r.roundType)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{tokenLabel}</td>
                    <td className="py-3 px-4 tabular-nums text-gray-800">{totalReward}</td>
                    <td className="py-3 px-4 text-gray-600">{fmtDur(r.startTime, r.endTime)}</td>
                    <td className="py-3 px-4">
                      {r.winners.length ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {r.winners.map((w, i) => (
                            <div key={w.addr + i} className="text-xs">
                              <a className="text-[#238D9D] hover:underline font-mono" href={`https://celoscan.io/address/${w.addr}`} target="_blank" rel="noreferrer">
                                {shortAddr(w.addr)}
                              </a>
                              {!isPhysical && w.amount && (
                                <span className="ml-1.5 text-gray-500 tabular-nums">{fmtAmountWithSymbol(w.amount, token)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
