// app/dashboard/draw/page.tsx
"use client";

import { useState } from "react";
import { useDrawableRounds } from "@/hooks/useDrawableRounds";
import { usePublicClient, useWriteContract } from "wagmi";
import managerAbi from "@/lib/abi/AkibaV3.json";
import { RAFFLE_MANAGER } from "@/lib/raffle-contract";
import type { Hex } from "viem";

const MAX_DIRECT_TICKETS = 25_000;
const CHUNK_BATCH_SIZE = 300;

const TYPE_BADGE: Record<number, { label: string; color: string }> = {
  0: { label: 'Single',   color: 'bg-gray-100 text-gray-700' },
  1: { label: 'Top-3',    color: 'bg-blue-50 text-blue-700' },
  2: { label: 'Top-5',    color: 'bg-purple-50 text-purple-700' },
  3: { label: 'Physical', color: 'bg-amber-50 text-amber-700' },
}

type ChunkStep = {
  id: number;
  step: 'counting' | 'building' | 'finalizing' | 'drawing';
  progress: number;
  total: number;
}

export default function DrawPage() {
  const { data, isLoading, isError, refetch } = useDrawableRounds();
  const pc = usePublicClient();
  const { writeContractAsync, status } = useWriteContract();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [chunkStep, setChunkStep] = useState<ChunkStep | null>(null);

  async function handleClose(id: number) {
    try {
      setBusyId(id);
      const tx = await writeContractAsync({
        abi: managerAbi,
        address: RAFFLE_MANAGER,
        functionName: "closeRaffle",
        args: [BigInt(id)],
      });
      await pc!.waitForTransactionReceipt({ hash: tx as Hex });
      await refetch();
      alert(`Closed & refunded round #${id}`);
    } catch (e: any) {
      alert(e?.shortMessage || e?.message || "Close failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDraw(id: number, totalTickets: number) {
    try {
      setBusyId(id);

      if (totalTickets > MAX_DIRECT_TICKETS) {
        // Step 1: count participants
        setChunkStep({ id, step: 'counting', progress: 0, total: 0 });
        const participants = await pc!.readContract({
          abi: managerAbi,
          address: RAFFLE_MANAGER,
          functionName: 'participantsOf',
          args: [BigInt(id)],
        }) as `0x${string}`[];

        const totalBatches = Math.ceil(participants.length / CHUNK_BATCH_SIZE);

        // Step 2: buildChunks in batches
        for (let i = 0; i < totalBatches; i++) {
          setChunkStep({ id, step: 'building', progress: i + 1, total: totalBatches });
          const tx = await writeContractAsync({
            abi: managerAbi,
            address: RAFFLE_MANAGER,
            functionName: 'buildChunks',
            args: [BigInt(id), BigInt(CHUNK_BATCH_SIZE)],
          });
          await pc!.waitForTransactionReceipt({ hash: tx as Hex });
        }

        // Step 3: finalizeChunks
        setChunkStep({ id, step: 'finalizing', progress: 0, total: 0 });
        const finalizeTx = await writeContractAsync({
          abi: managerAbi,
          address: RAFFLE_MANAGER,
          functionName: 'finalizeChunks',
          args: [BigInt(id)],
        });
        await pc!.waitForTransactionReceipt({ hash: finalizeTx as Hex });
      }

      // Step 4: drawWinner
      setChunkStep({ id, step: 'drawing', progress: 0, total: 0 });
      const tx = await writeContractAsync({
        abi: managerAbi,
        address: RAFFLE_MANAGER,
        functionName: 'drawWinner',
        args: [BigInt(id)],
      });
      await pc!.waitForTransactionReceipt({ hash: tx as Hex });
      await refetch();
      alert(`Draw complete for round #${id}`);
    } catch (e: any) {
      alert(e?.shortMessage || e?.message || "Draw failed");
    } finally {
      setBusyId(null);
      setChunkStep(null);
    }
  }

  function getDrawLabel(id: number, totalTickets: number): string {
    if (busyId !== id) return totalTickets > MAX_DIRECT_TICKETS ? 'Chunk & Draw' : 'Draw winner';
    if (!chunkStep || chunkStep.id !== id) return 'Drawing…';
    switch (chunkStep.step) {
      case 'counting':   return 'Counting…';
      case 'building':   return `Chunking ${chunkStep.progress}/${chunkStep.total}…`;
      case 'finalizing': return 'Finalizing…';
      case 'drawing':    return 'Drawing…';
    }
  }

  const active = (data || []).filter(r => r.canDraw || r.canClose || (!r.drawn && !r.closed))

  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div>
        <p className="font-semibold text-gray-900">Draw / Close Raffles</p>
        <p className="mt-0.5 text-xs text-gray-400">Manage open rounds — draw winners or close and refund</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600 py-4">Failed to load raffles.</p>
      ) : active.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No open raffles right now.</p>
      ) : (
        <div className="space-y-3">
          {active.map((r) => {
            const endsLabel =
              r.endsIn <= 0 ? 'Ended' :
              r.endsIn >= 86_400 ? `${Math.floor(r.endsIn / 86_400)}d left` :
              `${Math.floor(r.endsIn / 3600)}h ${Math.floor((r.endsIn % 3600) / 60)}m left`

            const badge = TYPE_BADGE[r.raffleType] ?? TYPE_BADGE[0]
            const ticketPct = r.maxTickets > 0 ? (r.totalTickets / r.maxTickets) * 100 : 0
            const needsChunking = r.totalTickets > MAX_DIRECT_TICKETS

            return (
              <div key={r.id} className="rounded-lg border bg-gray-50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">Round #{r.id}</span>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${r.randRequested ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {r.randRequested ? 'VRF ✓' : 'VRF pending'}
                      </span>
                      {needsChunking && (
                        <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-orange-50 text-orange-700">
                          Chunked draw
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">
                          {r.totalTickets.toLocaleString()}/{r.maxTickets.toLocaleString()} tickets
                          {r.maxReached && <span className="ml-1 text-green-600 font-medium">· max reached</span>}
                        </span>
                        <span className="text-xs text-gray-400">{endsLabel}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden w-48">
                        <div
                          className="h-full rounded-full bg-[#238D9D] transition-all"
                          style={{ width: `${Math.min(ticketPct, 100)}%` }}
                        />
                      </div>
                    </div>

                    <span className={`text-xs font-medium ${r.meetsThreshold ? 'text-green-700' : 'text-amber-700'}`}>
                      {r.meetsThreshold ? '✓ 10% threshold met' : '⚠ Below 10% threshold'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      disabled={!r.canClose || busyId === r.id || status === "pending"}
                      onClick={() => handleClose(r.id)}
                    >
                      {busyId === r.id && !r.canDraw ? "Closing…" : "Close & refund"}
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-[#238D9D] text-white px-3.5 py-2 text-sm font-medium hover:bg-[#1a6d7a] disabled:opacity-40 transition-colors"
                      disabled={!r.canDraw || busyId === r.id || status === "pending"}
                      onClick={() => handleDraw(r.id, r.totalTickets)}
                    >
                      {getDrawLabel(r.id, r.totalTickets)}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
