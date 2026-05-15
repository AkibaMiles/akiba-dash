// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { parseUnits, decodeEventLog, erc20Abi, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Card from "@/components/Card";
import {
  RaffleRequirementsFields,
  type Gate,
  type Mode,
} from "@/components/RaffleRequirementsEditor";
import managerAbi from "@/lib/abi/AkibaRaffleV7.json";
import {
  RAFFLE_MANAGER,
  readIsRaffleMinter,
  readPrizeNFT,
  readRaffleOwner,
} from "@/lib/raffle-contract";
import { AKIBA_MINIPOINTS } from "@/lib/constants";

const MILES = AKIBA_MINIPOINTS as `0x${string}`;

// Known reward tokens (for cash/miles raffles)
const TOKENS = [
  { symbol: "USDT",       address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
  { symbol: "cUSD",       address: "0x765de816845861e75a25fca122bb6898b8b1282a", decimals: 18 },
  { symbol: "AkibaMiles", address: MILES,                                         decimals: 18 },
] as const;
type Token = (typeof TOKENS)[number];

// Fixed VRF fee in CELO
const FIXED_FEE_CELO = "0.011";

type RaffleType = 0 | 1 | 2 | 3 | 4; // 0 single, 1 top3, 2 top5, 3 physical, 4 top10

const RAFFLE_WINNER_COUNTS: Record<RaffleType, number> = {
  0: 1,
  1: 3,
  2: 5,
  3: 1,
  4: 10,
};

// 🔔 Fire-and-forget call to our Telegram announce API
async function notifyTelegramRoundCreated(payload: any) {
  try {
    console.log("Notifying Telegram raffle-started API with payload:", payload);
    const res = await fetch("/api/admin/raffle-started", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("raffle-started API returned non-OK", res.status);
    }
  } catch (err) {
    console.error("Failed to call /api/admin/raffle-started", err);
  }
}

export default function CreateRaffleV7() {
  const pc = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync, status } = useWriteContract();
  const isPending = status === "pending";

  // form state
  const [token,       setToken]       = useState<Token>(TOKENS[0]);
  const [reward,      setReward]      = useState("");
  const [startMin,    setStartMin]    = useState("0");
  const [days,        setDays]        = useState("7");
  const [maxTick,     setMaxTick]     = useState("1000");
  const [costPts,     setCostPts]     = useState("10");
  const [raffleType,  setRaffleType]  = useState<RaffleType>(0);
  const [rewardURI,   setRewardURI]   = useState("");
  const [prizeNft,    setPrizeNft]    = useState<`0x${string}` | null>(null);
  const [cardTitle, setCardTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreview, setCardImagePreview] = useState("");
  const [prizeTitle, setPrizeTitle] = useState("");
  const [requirementsMode, setRequirementsMode] = useState<Mode>("all");
  const [requirementsEnabled, setRequirementsEnabled] = useState(false);
  const [requirementsGates, setRequirementsGates] = useState<Gate[]>([]);
  const [owner, setOwner] = useState<`0x${string}` | null>(null);
  const [isMinter, setIsMinter] = useState<boolean | null>(null);
  const cardImageInputRef = useRef<HTMLInputElement | null>(null);

  // randomness
  const [autoRequest, setAutoRequest] = useState(true);
  const [lastRoundId, setLastRoundId] = useState<string>("");

  useEffect(() => {
    readPrizeNFT().then(setPrizeNft).catch(() => setPrizeNft(null));
  }, []);

  useEffect(() => {
    if (!cardImageFile) {
      setCardImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(cardImageFile);
    setCardImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [cardImageFile]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminStatus() {
      try {
        const [ownerAddr, minterEnabled] = await Promise.all([
          readRaffleOwner(),
          address ? readIsRaffleMinter(address) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setOwner(ownerAddr);
        setIsMinter(minterEnabled);
      } catch {
        if (cancelled) return;
        setOwner(null);
        setIsMinter(null);
      }
    }

    void loadAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const isPhysical = raffleType === 3;
  const winnerCount = RAFFLE_WINNER_COUNTS[raffleType];
  const isOwner =
    !!address && !!owner && address.toLowerCase() === owner.toLowerCase();
  const canCreate = isOwner || isMinter === true;
  const displayToken =
    isPhysical && prizeNft
      ? { symbol: "PrizeNFT", address: prizeNft, decimals: 0 }
      : token;

  const rewardValid = useMemo(() => {
    if (isPhysical) return true; // reward forced to 0
    const n = Number(reward);
    return Number.isFinite(n) && n > 0;
  }, [reward, isPhysical]);
  const invalidMinUsdtRequirement = requirementsGates.some(
    (gate) =>
      gate.type === "min_usdt_balance" &&
      (!Number.isFinite(gate.minUsd) || gate.minUsd <= 0)
  );
  const requirementsInvalid =
    requirementsEnabled &&
    (requirementsGates.length === 0 || invalidMinUsdtRequirement);

  async function onSubmit() {
    try {
      if (!rewardValid) {
        alert("Reward must be greater than 0 (unless Physical).");
        return;
      }
      if (isPhysical && !prizeNft) {
        alert("Prize NFT address not set on the contract yet.");
        return;
      }
      if (requirementsEnabled && requirementsGates.length === 0) {
        alert("Entry requirements are enabled. Add at least one gate before creating the raffle.");
        return;
      }
      if (requirementsEnabled && invalidMinUsdtRequirement) {
        alert("Minimum USDT entry requirement must be greater than 0.");
        return;
      }

      const now     = Math.floor(Date.now() / 1000);
      const startTs = now + Number(startMin) * 60;
      const durSec  = Number(days) * 86_400;

      const tokenAddr: `0x${string}` =
        isPhysical ? (prizeNft as `0x${string}`) : (displayToken.address as `0x${string}`);

      const rewardWei = isPhysical
        ? 0n
        : parseUnits(reward, (displayToken as any).decimals || 18);

      const costWei = parseUnits(costPts || "0", 18);

      // 1) approve ERC20 if needed (USDT/cUSD only — NOT miles and NOT the prizeNFT)
      if (tokenAddr.toLowerCase() !== MILES.toLowerCase() &&
          (!isPhysical || tokenAddr.toLowerCase() !== (prizeNft || "").toLowerCase())) {
        await writeContractAsync({
          abi: erc20Abi,
          address: tokenAddr,
          functionName: "approve",
          args: [RAFFLE_MANAGER, rewardWei],
        });
      }

      // 2) create round (V7 signature)
      const txHash = await writeContractAsync({
        abi: managerAbi,
        address: RAFFLE_MANAGER,
        functionName: "createRaffleRound",
        args: [
          BigInt(startTs),
          BigInt(durSec),
          BigInt(maxTick),
          tokenAddr,
          raffleType,
          rewardWei,
          costWei,
          rewardURI || "",
        ],
      });

      const receipt = await pc!.waitForTransactionReceipt({ hash: txHash as Hex });

      // 3) extract roundId from RoundCreated
      let roundId: bigint | undefined;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: managerAbi,
            data: log.data,
            topics: log.topics,
          }) as { eventName: string; args: any };

          if (decoded.eventName === "RoundCreated") {
            const a = decoded.args;
            roundId = (a?.roundId ?? (Array.isArray(a) ? a[0] : undefined)) as bigint | undefined;
            if (roundId) break;
          }
        } catch {
          // ignore decode failures for other events
        }
      }

      const roundIdStr = roundId?.toString() ?? "";
      setLastRoundId(roundIdStr);
      const postCreateWarnings: string[] = [];

      // 4) request randomness (fixed fee)
      if (autoRequest && roundId) {
        const fee = parseUnits(FIXED_FEE_CELO, 18);
        const hash2 = await writeContractAsync({
          address: RAFFLE_MANAGER,
          abi: managerAbi,
          functionName: "requestRoundRandomness",
          args: [roundId],
          value: fee,
        });
        await pc!.waitForTransactionReceipt({ hash: hash2 as Hex });
      }

      // 5) notify Telegram (fire-and-forget)
      if (roundId) {
        const payload = {
          roundId: roundIdStr,
          raffleType,
          isPhysical,
          tokenSymbol: displayToken.symbol,
          tokenAddress: tokenAddr,
          rewardHuman: isPhysical ? "Physical prize" : reward,
          rewardWei: rewardWei.toString(),
          ticketCostMiles: costPts,
          maxTickets: maxTick,
          startTime: startTs,
          durationSeconds: durSec,
          rewardURI: rewardURI || null,
        };
        void notifyTelegramRoundCreated(payload);
      }

      if (roundId) {
        let uploadedCardImageUrl: string | null = null;

        if (cardImageFile) {
          try {
            const imageForm = new FormData();
            imageForm.append("file", cardImageFile);
            imageForm.append("roundId", roundId.toString());

            const uploadRes = await fetch("/api/admin/raffles/upload-image", {
              method: "POST",
              body: imageForm,
            });
            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok) {
              throw new Error(uploadJson?.error || "Image upload failed");
            }
            uploadedCardImageUrl = uploadJson.publicUrl;
          } catch (err: any) {
            console.error("Failed to upload raffle image", err);
            postCreateWarnings.push(err?.message || "image upload failed");
          }
        }

        const metaPayload = {
          roundId: Number(roundId),
          raffleType,
          kind: isPhysical ? "physical" : "token",
          cardTitle: cardTitle || null,
          description: description || null,
          cardImageUrl: uploadedCardImageUrl,
          prizeTitle:
            prizeTitle ||
            (isPhysical
              ? "Physical prize"
              : `${reward || "0"} ${displayToken.symbol}`),
          winners: winnerCount,
        };
      
        try {
          const metaRes = await fetch("/api/admin/raffles/meta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metaPayload),
          });
          const metaJson = await metaRes.json().catch(() => ({}));
          if (!metaRes.ok) {
            throw new Error(metaJson?.error || "metadata save failed");
          }
        } catch (err) {
          console.error("Failed to save raffle_meta", err);
          postCreateWarnings.push("metadata save failed");
        }

        if (requirementsEnabled) {
          try {
            const requirementsRes = await fetch("/api/admin/raffle-requirements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                round_id: Number(roundId),
                mode: requirementsMode,
                enabled: true,
                gates: requirementsGates,
              }),
            });
            const requirementsJson = await requirementsRes.json().catch(() => ({}));
            if (!requirementsRes.ok) {
              throw new Error(requirementsJson?.error || "requirements save failed");
            }
          } catch (err) {
            console.error("Failed to save raffle_requirements", err);
            postCreateWarnings.push("entry requirements save failed");
          }
        }
      }
      
      const warningText = postCreateWarnings.length
        ? `\n\nWarnings:\n- ${postCreateWarnings.join("\n- ")}`
        : "";

      alert(
        `Round #${roundIdStr || "?"} created${
          autoRequest ? " & randomness requested" : ""
        }! 🎉${warningText}`
      );
      setReward("");
      setCardImageFile(null);
      setCardImagePreview("");
      setRequirementsMode("all");
      setRequirementsEnabled(false);
      setRequirementsGates([]);
      if (cardImageInputRef.current) cardImageInputRef.current.value = "";
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Transaction failed");
    }
  }

  const submitDisabled =
    isPending ||
    !rewardValid ||
    requirementsInvalid ||
    (!!address && isMinter !== null && !canCreate);

  return (
    <div className="max-w-2xl">
      <Card title="Create Raffle (V7)">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {/* raffle type */}
          <div>
            <Label htmlFor="rtype">Raffle type</Label>
            <select
              id="rtype"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={raffleType}
              onChange={(e) => {
                setRaffleType(Number(e.target.value) as RaffleType);
              }}
            >
              <option value={0}>Single winner</option>
              <option value={1}>Top 3 (equal split)</option>
              <option value={2}>Top 5 (equal split)</option>
              <option value={3}>Physical prize (NFT voucher)</option>
              <option value={4}>Top 10 (equal split)</option>
            </select>
          </div>

          {/* token + reward */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="token">Reward token</Label>
              {isPhysical ? (
                <Input id="token" disabled value={prizeNft ? `PrizeNFT (${prizeNft})` : "PrizeNFT (unset)"} />
              ) : (
                <select
                  id="token"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={token.symbol}
                  onChange={(e) =>
                    setToken(TOKENS.find((t) => t.symbol === e.target.value)!)
                  }
                >
                  {TOKENS.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.symbol}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <Label htmlFor="reward">
                {isPhysical ? "Reward pool" : `Reward pool (${displayToken.symbol})`}
              </Label>
              <Input
                id="reward"
                placeholder={isPhysical ? "0 (physical prize)" : "e.g. 500"}
                value={isPhysical ? "0" : reward}
                onChange={(e) => setReward(e.target.value)}
                disabled={isPhysical}
              />
              {!rewardValid && reward !== "" && (
                <p className="mt-1 text-xs text-red-600">Enter an amount &gt; 0</p>
              )}
            </div>
          </div>

          {/* rewardURI (used for physical NFT voucher; harmless for others) */}
          <div>
            <Label htmlFor="ruri">Reward URI (image/metadata)</Label>
            <Input
              id="ruri"
              placeholder="ipfs://... or https://..."
              value={rewardURI}
              onChange={(e) => setRewardURI(e.target.value)}
            />
          </div>

          {/* timing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Starts in (minutes)</Label>
              <Input
                id="start"
                placeholder="0"
                value={startMin}
                onChange={(e) => setStartMin(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                placeholder="7"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>

          {/* tickets */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max">Maximum tickets</Label>
              <Input
                id="max"
                placeholder="1000"
                value={maxTick}
                onChange={(e) => setMaxTick(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cost">Ticket cost (AkibaMiles)</Label>
              <Input
                id="cost"
                placeholder="10"
                value={costPts}
                onChange={(e) => setCostPts(e.target.value)}
              />
            </div>
          </div>

          {/* UI metadata (off-chain) */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <h3 className="font-medium text-sm">Contract status</h3>
              <div className="mt-2 rounded-md border bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p>
                  Manager:{" "}
                  <span className="font-mono text-gray-800 break-all">{RAFFLE_MANAGER}</span>
                </p>
                <p>
                  Owner:{" "}
                  <span className="font-mono text-gray-800 break-all">{owner ?? "Unable to load"}</span>
                </p>
                <p>
                  Prize NFT:{" "}
                  <span className="font-mono text-gray-800 break-all">{prizeNft ?? "Unable to load"}</span>
                </p>
                <p>
                  Connected role:{" "}
                  <span className={canCreate ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                    {!address ? "Wallet not connected" : canCreate ? (isOwner ? "Owner" : "Minter") : "Not owner/minter"}
                  </span>
                </p>
              </div>
            </div>

            <h3 className="font-medium text-sm">Display / UI settings</h3>

            <div>
              <Label htmlFor="cardTitle">Card title</Label>
              <Input
                id="cardTitle"
                placeholder={isPhysical ? "e.g. JBL Tune 700BT Headphones" : "e.g. 500 USDT Weekly Jackpot"}
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Shown on the raffle card. If empty, frontend falls back to {`rewardPool token`}.
              </p>
            </div>

            <div>
              <Label htmlFor="desc">Description / blurb</Label>
              <Input
                id="desc"
                placeholder="Short description for the sheet"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="img">Card image</Label>
              <Input
                ref={cardImageInputRef}
                id="img"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && !file.type.startsWith("image/")) {
                    alert("Please choose an image file.");
                    e.target.value = "";
                    setCardImageFile(null);
                    return;
                  }
                  setCardImageFile(file);
                }}
              />
              {cardImagePreview && (
                <div className="mt-3 overflow-hidden rounded-lg border bg-gray-50">
                  <Image
                    src={cardImagePreview}
                    alt="Selected raffle card preview"
                    width={640}
                    height={160}
                    unoptimized
                    className="h-40 w-full object-cover"
                  />
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Select an image here. The dashboard uploads it to Supabase Storage and saves the public URL with the raffle metadata.
              </p>
            </div>

            <div>
              <Label htmlFor="prizeTitle">Prize title (optional)</Label>
              <Input
                id="prizeTitle"
                placeholder={isPhysical ? "JBL Tune 700BT Wireless Over-Ear..." : "Optional override"}
                value={prizeTitle}
                onChange={(e) => setPrizeTitle(e.target.value)}
              />
            </div>

            <div>
              <Label>Number of winners</Label>
              <div className="mt-1 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {winnerCount}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Derived from the selected raffle type so off-chain metadata matches the contract.
              </p>
            </div>
          </div>

          {/* Entry requirements (off-chain) */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <h3 className="font-medium text-sm">Entry requirements</h3>
              <p className="mt-1 text-xs text-gray-500">
                Optional dApp gates saved to Supabase after the round is created.
              </p>
            </div>

            <RaffleRequirementsFields
              mode={requirementsMode}
              enabled={requirementsEnabled}
              gates={requirementsGates}
              onModeChange={setRequirementsMode}
              onEnabledChange={setRequirementsEnabled}
              onGatesChange={setRequirementsGates}
            />

            {requirementsEnabled && requirementsGates.length === 0 && (
              <p className="text-sm text-red-600">
                Add at least one gate or disable gating before creating the raffle.
              </p>
            )}
            {requirementsEnabled && invalidMinUsdtRequirement && (
              <p className="text-sm text-red-600">
                Minimum USDT requirement must be greater than 0.
              </p>
            )}
          </div>


          {/* randomness toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRequest}
                onChange={(e) => setAutoRequest(e.target.checked)}
              />
              Request randomness immediately (fee {FIXED_FEE_CELO} CELO)
            </label>
          </div>

          <Button disabled={submitDisabled} type="submit">
            {isPending ? "Submitting…" : "Create"}
          </Button>

          {lastRoundId && (
            <p className="text-xs text-gray-500 mt-2">
              Last created round: #{lastRoundId}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
