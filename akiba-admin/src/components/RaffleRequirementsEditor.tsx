"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ────────────────────────────────────────────────────────────────────

export type GateType = "min_usdt_balance" | "prosperity_pass_holder" | "daily_5tx_completed";

export type Gate =
  | { type: "min_usdt_balance"; minUsd: number }
  | { type: "prosperity_pass_holder" }
  | { type: "daily_5tx_completed" };

export type Mode = "all" | "any";

export type RequirementsRow = {
  round_id: number;
  mode: Mode;
  enabled: boolean;
  gates: Gate[];
};

// ── Gate presets ─────────────────────────────────────────────────────────────

const PRESET_LABELS: Record<GateType, string> = {
  min_usdt_balance: "Minimum USDT balance",
  prosperity_pass_holder: "Prosperity Pass holder",
  daily_5tx_completed: "Completed today's 5-transfer quest",
};

function defaultGate(type: GateType): Gate {
  if (type === "min_usdt_balance") return { type, minUsd: 10 };
  return { type } as Gate;
}

// ── Gate summary (exported for use in list rows) ──────────────────────────────

export function gateLabel(gate: Gate): string {
  if (gate.type === "min_usdt_balance") return `${gate.minUsd} USDT`;
  if (gate.type === "prosperity_pass_holder") return "Pass";
  if (gate.type === "daily_5tx_completed") return "5tx Quest";
  return (gate as any).type;
}

export function requirementsSummary(row: RequirementsRow): string {
  if (!row.enabled || row.gates.length === 0) return "";
  const sep = row.mode === "all" ? " + " : " or ";
  return `Gated: ${row.gates.map(gateLabel).join(sep)}`;
}

// ── Sub-component: single gate editor ────────────────────────────────────────

function GateEditor({
  gate,
  onChange,
  onRemove,
}: {
  gate: Gate;
  onChange: (g: Gate) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-gray-50 px-3 py-2.5">
      <span className="flex-1 text-sm font-medium text-gray-700">
        {PRESET_LABELS[gate.type]}
      </span>

      {gate.type === "min_usdt_balance" && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`minUsd-${gate.type}`} className="text-xs text-gray-500 shrink-0">
            Min USD
          </Label>
          <Input
            id={`minUsd-${gate.type}`}
            type="number"
            min={0}
            step={1}
            className="w-24 h-7 text-sm"
            value={gate.minUsd}
            onChange={(e) =>
              onChange({ ...gate, minUsd: Number(e.target.value) || 0 })
            }
          />
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="ml-2 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
        aria-label="Remove gate"
      >
        ×
      </button>
    </div>
  );
}

// ── Controlled fields ────────────────────────────────────────────────────────

type FieldsProps = {
  mode: Mode;
  enabled: boolean;
  gates: Gate[];
  roundId?: number;
  onModeChange: (mode: Mode) => void;
  onEnabledChange: (enabled: boolean) => void;
  onGatesChange: (gates: Gate[]) => void;
  onDirty?: () => void;
};

export function RaffleRequirementsFields({
  mode,
  enabled,
  gates,
  roundId = 0,
  onModeChange,
  onEnabledChange,
  onGatesChange,
  onDirty,
}: FieldsProps) {
  const [addType, setAddType] = useState<GateType>("min_usdt_balance");

  const addedTypes = new Set(gates.map((g) => g.type));
  const availablePresets = (
    Object.keys(PRESET_LABELS) as GateType[]
  ).filter((t) => !addedTypes.has(t));

  // Keep addType valid when gates change
  useEffect(() => {
    if (!availablePresets.includes(addType) && availablePresets.length > 0) {
      setAddType(availablePresets[0]);
    }
  }, [availablePresets.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  function markDirty() {
    onDirty?.();
  }

  function addGate() {
    if (!availablePresets.includes(addType)) return;
    onGatesChange([...gates, defaultGate(addType)]);
    markDirty();
  }

  function updateGate(i: number, g: Gate) {
    onGatesChange(gates.map((old, idx) => (idx === i ? g : old)));
    markDirty();
  }

  function removeGate(i: number) {
    onGatesChange(gates.filter((_, idx) => idx !== i));
    markDirty();
  }

  const summary = requirementsSummary({ round_id: roundId, mode, enabled, gates });

  return (
    <div className="space-y-4">
      {/* Header row: enabled toggle + mode */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium select-none cursor-pointer">
          <div
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              onEnabledChange(!enabled);
              markDirty();
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              enabled ? "bg-[#238D9D]" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
          Gating enabled
        </label>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Require</span>
          <select
            value={mode}
            onChange={(e) => {
              onModeChange(e.target.value as Mode);
              markDirty();
            }}
            className="rounded-md border px-2 py-1 text-sm"
          >
            <option value="all">all gates (AND)</option>
            <option value="any">any gate (OR)</option>
          </select>
        </div>
      </div>

      {/* Current gates */}
      <div className="space-y-2">
        {gates.length === 0 && (
          <p className="text-sm text-gray-400 italic">No gates added yet.</p>
        )}
        {gates.map((g, i) => (
          <GateEditor
            key={`${g.type}-${i}`}
            gate={g}
            onChange={(updated) => updateGate(i, updated)}
            onRemove={() => removeGate(i)}
          />
        ))}
      </div>

      {/* Add gate */}
      {availablePresets.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as GateType)}
            className="flex-1 rounded-md border px-2 py-1.5 text-sm"
          >
            {availablePresets.map((t) => (
              <option key={t} value={t}>
                {PRESET_LABELS[t]}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="secondary" onClick={addGate}>
            + Add gate
          </Button>
        </div>
      )}

      {/* Summary preview */}
      {gates.length > 0 && (
        <p className="text-xs text-gray-500">
          Preview:{" "}
          <span className="font-medium text-gray-700">
            {summary || "Not enforced until gating is enabled."}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  roundId: number;
  onSaved?: () => void;
};

export default function RaffleRequirementsEditor({ roundId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [mode, setMode] = useState<Mode>("all");
  const [enabled, setEnabled] = useState(false);
  const [gates, setGates] = useState<Gate[]>([]);

  // Load existing config
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/raffle-requirements?round_id=${roundId}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setMode(data.mode ?? "all");
          setEnabled(Boolean(data.enabled));
          setGates(Array.isArray(data.gates) ? data.gates : []);
        } else {
          setMode("all");
          setEnabled(false);
          setGates([]);
        }
      })
      .catch(() => setError("Failed to load existing config"))
      .finally(() => setLoading(false));
  }, [roundId]);

  async function save() {
    if (gates.length === 0) {
      setError("Add at least one gate before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/raffle-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_id: roundId, mode, enabled, gates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSuccess(true);
      onSaved?.();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-100" />
      </div>
    );
  }

  const canSave = gates.length > 0;

  return (
    <div className="space-y-4">
      <RaffleRequirementsFields
        roundId={roundId}
        mode={mode}
        enabled={enabled}
        gates={gates}
        onModeChange={setMode}
        onEnabledChange={setEnabled}
        onGatesChange={setGates}
        onDirty={() => setSuccess(false)}
      />

      {/* Validation / feedback */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="text-sm text-green-700 font-medium">Saved successfully.</p>
      )}

      <Button
        type="button"
        onClick={save}
        disabled={saving || !canSave}
        className="mt-1"
      >
        {saving ? "Saving…" : "Save requirements"}
      </Button>
    </div>
  );
}
