// app/dashboard/requirements/page.tsx
"use client";

import { useState } from "react";
import { useAdminRounds } from "@/hooks/useAdminRounds";
import { useRaffleRequirements } from "@/hooks/useRaffleRequirements";
import { requirementsSummary } from "@/components/RaffleRequirementsEditor";
import RaffleRequirementsEditor from "@/components/RaffleRequirementsEditor";
import Card from "@/components/Card";

const TYPE_LABEL: Record<number, string> = {
  0: "Single",
  1: "Top-3",
  2: "Top-5",
  3: "Physical",
  4: "Top-10",
};

const TYPE_COLOR: Record<number, string> = {
  0: "bg-gray-100 text-gray-700",
  1: "bg-blue-50 text-blue-700",
  2: "bg-purple-50 text-purple-700",
  3: "bg-amber-50 text-amber-700",
  4: "bg-emerald-50 text-emerald-700",
};

export default function RequirementsPage() {
  const { data: rounds, isLoading: roundsLoading } = useAdminRounds();
  const { data: requirements, refetch: refetchReqs } = useRaffleRequirements();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const reqMap = new Map((requirements ?? []).map((r) => [r.round_id, r]));

  const sortedRounds = (rounds ?? []).slice().sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-6 max-w-4xl">
      <Card title="Raffle Gate Requirements">
        <p className="text-sm text-gray-500 mb-4">
          Configure gating rules per round. Gates are enforced at the dApp level — not written to the smart contract.
        </p>

        {roundsLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : sortedRounds.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No rounds found.</p>
        ) : (
          <div className="space-y-2">
            {sortedRounds.map((round) => {
              const req = reqMap.get(round.id);
              const summary = req ? requirementsSummary(req) : null;
              const isOpen = selectedId === round.id;

              const statusLabel = round.drawn
                ? "Drawn"
                : round.active
                ? "Active"
                : round.endsIn > 0
                ? "Upcoming"
                : "Ended";
              const statusColor = round.drawn
                ? "text-gray-400"
                : round.active
                ? "text-green-600"
                : round.endsIn > 0
                ? "text-blue-600"
                : "text-gray-500";

              return (
                <div key={round.id} className="rounded-lg border overflow-hidden">
                  {/* Round header row */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      setSelectedId(isOpen ? null : round.id)
                    }
                  >
                    <span className="font-semibold text-gray-900 w-20 shrink-0">
                      #{round.id}
                    </span>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
                        TYPE_COLOR[round.raffleType] ?? TYPE_COLOR[0]
                      }`}
                    >
                      {TYPE_LABEL[round.raffleType] ?? `Type ${round.raffleType}`}
                    </span>
                    <span className={`text-xs font-medium shrink-0 ${statusColor}`}>
                      {statusLabel}
                    </span>

                    <span className="flex-1" />

                    {summary ? (
                      <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-violet-50 text-violet-700 shrink-0">
                        {summary}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 shrink-0">No gate</span>
                    )}

                    <span className="text-gray-400 text-sm ml-2">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {/* Expandable editor */}
                  {isOpen && (
                    <div className="border-t bg-white px-4 py-4">
                      <RaffleRequirementsEditor
                        roundId={round.id}
                        onSaved={refetchReqs}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
