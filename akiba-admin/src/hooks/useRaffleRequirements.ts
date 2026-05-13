"use client";

import { useQuery } from "@tanstack/react-query";

export type Gate =
  | { type: "min_usdt_balance"; minUsd: number }
  | { type: "prosperity_pass_holder" }
  | { type: "daily_5tx_completed" };

export type RaffleRequirement = {
  round_id: number;
  mode: "all" | "any";
  enabled: boolean;
  gates: Gate[];
};

export function useRaffleRequirements() {
  return useQuery<RaffleRequirement[]>({
    queryKey: ["raffle-requirements"],
    queryFn: async () => {
      const res = await fetch("/api/admin/raffle-requirements");
      if (!res.ok) throw new Error("Failed to fetch requirements");
      const { data } = await res.json();
      return data ?? [];
    },
    staleTime: 30_000,
  });
}
