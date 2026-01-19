"use client";

import * as React from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";

import { addresses, USDC_DECIMALS, REQUIRED_CHAIN_ID } from "../../lib/addresses";
import { erc20Abi, raffleManagerAbi } from "../../lib/abis";
import { MoneyRain } from "../../components/MoneyRain";
import { RevealModal } from "../../components/RevealModal";
import { SlotWinners } from "../../components/SlotWinners";

console.log("MANAGER (client):", addresses.manager);
console.log("USDC (client):", addresses.usdc);
console.log("CHAIN (client):", REQUIRED_CHAIN_ID);

const TICKET_PRICE = 10n * 10n ** 6n;

type PotProps = {
  title: string;
  rType: 0 | 1 | 2 | 3;
  onCoinInsert?: () => void;
  pulseToken?: number;
  wrongNetwork: boolean;
  hasAddresses: boolean;

  // slot animation trigger (Finalized for this type)
  slotTrigger: number;
};

function isAddress(x: unknown): x is `0x${string}` {
  return typeof x === "string" && /^0x[a-fA-F0-9]{40}$/.test(x);
}

function playCoinSound() {
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "square";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 0.05);

    osc2.frequency.setValueAtTime(1320, now);
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.06);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.13);
    osc2.stop(now + 0.13);

    setTimeout(() => ctx.close().catch(() => {}), 250);
  } catch {}
}

function Pot({
  title,
  rType,
  onCoinInsert,
  pulseToken,
  wrongNetwork,
  hasAddresses,
  slotTrigger,
}: PotProps) {
  const { address } = useAccount();
  const [tickets, setTickets] = React.useState("1");
  const [pulse, setPulse] = React.useState(false);

  // local tx state so other actions don't get disabled globally
  const [depositPending, setDepositPending] = React.useState(false);
  const [approvePending, setApprovePending] = React.useState(false);

  React.useEffect(() => {
    if (!pulseToken) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 360);
    return () => clearTimeout(t);
  }, [pulseToken]);

  const ticketsNum = Number(tickets);
  const safeTicketsNum =
    Number.isFinite(ticketsNum) && ticketsNum >= 1 ? Math.floor(ticketsNum) : 1;

  const ticketCount = BigInt(safeTicketsNum);
  const cost = parseUnits((safeTicketsNum * 10).toString(), USDC_DECIMALS);

  const { data: round } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "getRoundInfo",
    args: [rType],
    query: { enabled: hasAddresses, refetchInterval: 2000 },
  });

  const roundId = round ? (round[0] as bigint) : 0n;
  const targetPot = round ? (round[1] as bigint) : 0n;
  const deposited = round ? (round[2] as bigint) : 0n;
  const totalTickets = round ? (round[3] as number) : 0;
  const drawing = round ? (round[4] as boolean) : false;

  const remainingUSDC = targetPot > deposited ? targetPot - deposited : 0n;
  const remainingTickets = remainingUSDC / TICKET_PRICE;
  const progressPct = targetPot > 0n ? Number((deposited * 100n) / targetPot) : 0;

  const { data: allowance } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: addresses.usdc,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      addresses.manager,
    ],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });

  const allowanceValue = allowance ?? 0n;
  const needsApproval = !address || allowanceValue < cost;

  const { writeContractAsync } = useWriteContract();

  async function approve() {
    if (!address || wrongNetwork || !hasAddresses) return;
    try {
      setApprovePending(true);
      await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: erc20Abi,
        address: addresses.usdc,
        functionName: "approve",
        args: [addresses.manager, cost],
      });
    } finally {
      setApprovePending(false);
    }
  }

  async function depositFn() {
    if (!address || wrongNetwork || !hasAddresses) return;

    onCoinInsert?.();
    try {
      if (navigator.vibrate) navigator.vibrate(25);
    } catch {}

    try {
      setDepositPending(true);
      await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: raffleManagerAbi,
        address: addresses.manager,
        functionName: "deposit",
        args: [rType, ticketCount],
      });
    } finally {
      setDepositPending(false);
    }
  }

  return (
    <div className={`panel potCard cabinetPot ${pulse ? "pulse" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="h2 truncate">{title}</div>
        <div className="muted text-[10px]">R{roundId.toString()}</div>
      </div>

      <div className="mt-3 slot">
        <div className="h1">{formatUnits(targetPot, USDC_DECIMALS)} USDC</div>
        <div className="muted text-[10px]">
          {drawing ? "SETTLING..." : "OPEN"} • {progressPct}% FILLED
        </div>

        <div className="mt-2 bar">
          <div style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="mt-3 stats">
        <div className="inset statBox">
          <div className="muted text-[10px]">SOLD</div>
          <div className="h2">{totalTickets}</div>
        </div>
        <div className="inset statBox">
          <div className="muted text-[10px]">LEFT</div>
          <div className="h2">{remainingTickets.toString()}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="muted text-[10px]">TICKETS</div>
        <input
          className="input mt-1"
          value={tickets}
          onChange={(e) => setTickets(e.target.value)}
          type="number"
          min={1}
        />
        <div className="muted text-[10px] mt-2">
          COST: {formatUnits(cost, USDC_DECIMALS)} USDC
        </div>
      </div>

      {wrongNetwork && (
        <div className="danger text-[10px] mt-2">
          SWITCH TO BASE SEPOLIA (CHAIN {REQUIRED_CHAIN_ID})
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          className="btn btnMint flex-1"
          onClick={approve}
          disabled={!address || wrongNetwork || !hasAddresses || approvePending || depositPending}
        >
          {approvePending ? "APPROVING..." : "APPROVE"}
        </button>

        <button
          className="btn btnGold flex-1"
          onClick={depositFn}
          disabled={
            !address ||
            wrongNetwork ||
            !hasAddresses ||
            needsApproval ||
            drawing ||
            depositPending ||
            approvePending ||
            ticketCount > remainingTickets
          }
        >
          {depositPending ? "DEPOSITING..." : "DEPOSIT"}
        </button>
      </div>

      {!drawing && ticketCount > remainingTickets && (
        <div className="danger text-[10px] mt-2">
          TOO MANY. LEFT: {remainingTickets.toString()}
        </div>
      )}

      {/* SLOT MACHINE ANIMATION (rolling symbols) */}
      <div className="mt-4">
        <SlotWinners trigger={slotTrigger} label={`${title} REELS`} />
      </div>
    </div>
  );
}

type Stage = "idle" | "spinning" | "mining" | "done" | "error";

export default function PlayPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  const hasAddresses = isAddress(addresses.manager) && isAddress(addresses.usdc);

  const { writeContractAsync } = useWriteContract();

  const [rainTrigger, setRainTrigger] = React.useState(0);

  const [pulseSmall, setPulseSmall] = React.useState(0);
  const [pulseMed, setPulseMed] = React.useState(0);
  const [pulseLarge, setPulseLarge] = React.useState(0);
  const [pulseMega, setPulseMega] = React.useState(0);

  // Slot triggers per raffle type
  const [slotTrigSmall, setSlotTrigSmall] = React.useState(0);
  const [slotTrigMed, setSlotTrigMed] = React.useState(0);
  const [slotTrigLarge, setSlotTrigLarge] = React.useState(0);
  const [slotTrigMega, setSlotTrigMega] = React.useState(0);

  // Local tx state for reveal/claim
  const [revealPending, setRevealPending] = React.useState(false);
  const [claimPending, setClaimPending] = React.useState(false);

  // Claim buckets
  const { data: refundsAvail } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "refunds",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });

  const { data: winningsAvail } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "winnings",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });

  const refundsAmt = refundsAvail ?? 0n;
  const winningsAmt = winningsAvail ?? 0n;
  const totalClaimable = refundsAmt + winningsAmt;

  // Reveal eligibility per type (participant-only)
  const { data: rev0 } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "revealableRound",
    args: [0, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });
  const { data: rev1 } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "revealableRound",
    args: [1, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });
  const { data: rev2 } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "revealableRound",
    args: [2, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });
  const { data: rev3 } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "revealableRound",
    args: [3, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });

  function firstRevealType(): 0 | 1 | 2 | 3 | null {
    if (rev0?.[0]) return 0;
    if (rev1?.[0]) return 1;
    if (rev2?.[0]) return 2;
    if (rev3?.[0]) return 3;
    return null;
  }

  const revealType = firstRevealType();
  const revealEnabled = revealType !== null;

  // Reveal modal state
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [revealStage, setRevealStage] = React.useState<Stage>("idle");
  const [revealError, setRevealError] = React.useState<string | null>(null);

  // "You won X" delta tracking (snapshot per reveal click)
  const [wBefore, setWBefore] = React.useState<bigint>(0n);
  const [wDelta, setWDelta] = React.useState<bigint>(0n);

  React.useEffect(() => {
    setWBefore(0n);
    setWDelta(0n);
    setRevealOpen(false);
    setRevealStage("idle");
    setRevealError(null);
  }, [address]);

  async function revealFn() {
    if (!address || wrongNetwork || !hasAddresses) return;
    if (revealType === null) return;

    const before = winningsAmt;
    setWBefore(before);
    setWDelta(0n);

    setRevealError(null);
    setRevealOpen(true);
    setRevealStage("spinning");

    await new Promise((r) => setTimeout(r, 900));

    try {
      setRevealPending(true);
      setRevealStage("mining");

      await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: raffleManagerAbi,
        address: addresses.manager,
        functionName: "reveal",
        args: [revealType],
      });

      setRevealStage("done");
    } catch (e: any) {
      setRevealStage("error");
      setRevealError(e?.shortMessage || e?.message || "Reveal failed");
    } finally {
      setRevealPending(false);
    }
  }

  React.useEffect(() => {
    if (!revealOpen) return;
    if (revealStage !== "done") return;

    const after = winningsAmt;
    const delta = after > wBefore ? after - wBefore : 0n;
    setWDelta(delta);
  }, [winningsAmt, revealOpen, revealStage, wBefore]);

  async function claimFn() {
    if (!address || wrongNetwork || !hasAddresses) return;
    if (totalClaimable === 0n) return;

    try {
      setClaimPending(true);
      await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: raffleManagerAbi,
        address: addresses.manager,
        functionName: "claim",
        args: [],
      });
    } finally {
      setClaimPending(false);
    }
  }

  // Rain on finalized (global) + slot triggers (per type)
  useWatchContractEvent({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    eventName: "Finalized",
    enabled: hasAddresses,
    onLogs: (logs) => {
      setRainTrigger((n) => n + 1);

      for (const l of logs) {
        // wagmi gives decoded args on log.args when ABI matches
        const rt = (l as any)?.args?.rType as number | undefined;
        if (rt === 0) setSlotTrigSmall((n) => n + 1);
        else if (rt === 1) setSlotTrigMed((n) => n + 1);
        else if (rt === 2) setSlotTrigLarge((n) => n + 1);
        else if (rt === 3) setSlotTrigMega((n) => n + 1);
      }
    },
  });

  return (
    <main className="screen" style={{ position: "relative" }}>
      <MoneyRain trigger={rainTrigger} />

      <RevealModal
        open={revealOpen}
        stage={revealStage}
        onClose={() => {
          setRevealOpen(false);
          setRevealStage("idle");
          setRevealError(null);
        }}
        error={revealError}
        wonDelta={wDelta}
      />

      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="muted text-[10px]">
          PLAY AT YOUR OWN RISK • ROUND COMPLETES WHEN ALL TICKETS ARE SOLD • WINNERS MUST REVEAL THEN CLAIM
        </div>
      </div>

      <div className="panel px-5 py-3 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="muted text-[10px]">
              Refunds available: {formatUnits(refundsAmt, USDC_DECIMALS)} USDC
            </div>
            <div className="muted text-[10px] mt-1">
              Winnings available: {formatUnits(winningsAmt, USDC_DECIMALS)} USDC
            </div>

            {wDelta > 0n && (
              <div className="mt-2">
                <div className="badgeWin">
                  YOU WON {formatUnits(wDelta, USDC_DECIMALS)} USDC
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="btn btnMint"
              onClick={revealFn}
              disabled={
                !address ||
                wrongNetwork ||
                !hasAddresses ||
                revealPending ||
                claimPending ||
                !revealEnabled
              }
            >
              {revealPending ? "REVEALING..." : "REVEAL"}
            </button>

            <button
              className="btn btnGold"
              onClick={claimFn}
              disabled={
                !address ||
                wrongNetwork ||
                !hasAddresses ||
                claimPending ||
                revealPending ||
                totalClaimable === 0n
              }
            >
              {claimPending ? "CLAIMING..." : "CLAIM"}
            </button>
          </div>
        </div>

        <div className="muted text-[10px] mt-2">
          Reveal is only enabled if you participated in a round that is ready to settle. Claim transfers credited winnings + refunds.
        </div>
      </div>

      {!hasAddresses && (
        <div className="panel px-5 py-3 text-center mt-4">
          <div className="danger text-[10px]">CONFIG ERROR</div>
          <div className="muted text-[10px] mt-1">
            Missing NEXT_PUBLIC_MANAGER / NEXT_PUBLIC_USDC (or invalid addresses).
          </div>
        </div>
      )}

      {wrongNetwork && (
        <div className="panel px-5 py-3 text-center mt-4">
          <div className="danger text-[10px]">WRONG NETWORK</div>
          <div className="muted text-[10px] mt-1">
            Switch to Base Sepolia (Chain ID {REQUIRED_CHAIN_ID}) to buy tickets.
          </div>
        </div>
      )}

      <div className="mt-5 potRow">
        <Pot
          title="SMALL"
          rType={0}
          slotTrigger={slotTrigSmall}
          pulseToken={pulseSmall}
          wrongNetwork={wrongNetwork}
          hasAddresses={hasAddresses}
          onCoinInsert={() => {
            playCoinSound();
            setPulseSmall((n) => n + 1);
          }}
        />
        <Pot
          title="MEDIUM"
          rType={1}
          slotTrigger={slotTrigMed}
          pulseToken={pulseMed}
          wrongNetwork={wrongNetwork}
          hasAddresses={hasAddresses}
          onCoinInsert={() => {
            playCoinSound();
            setPulseMed((n) => n + 1);
          }}
        />
        <Pot
          title="LARGE"
          rType={2}
          slotTrigger={slotTrigLarge}
          pulseToken={pulseLarge}
          wrongNetwork={wrongNetwork}
          hasAddresses={hasAddresses}
          onCoinInsert={() => {
            playCoinSound();
            setPulseLarge((n) => n + 1);
          }}
        />
        <Pot
          title="MEGA"
          rType={3}
          slotTrigger={slotTrigMega}
          pulseToken={pulseMega}
          wrongNetwork={wrongNetwork}
          hasAddresses={hasAddresses}
          onCoinInsert={() => {
            playCoinSound();
            setPulseMega((n) => n + 1);
          }}
        />
      </div>
    </main>
  );
}
