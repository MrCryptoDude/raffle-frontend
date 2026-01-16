"use client";

import * as React from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { formatUnits, parseUnits } from "viem";

import { addresses, USDC_DECIMALS, REQUIRED_CHAIN_ID } from "../../lib/addresses";
import { erc20Abi, raffleManagerAbi } from "../../lib/abis";
import { MoneyRain } from "../../components/MoneyRain";
import { SlotWinners } from "../../components/SlotWinners";

const TICKET_PRICE = 10n * 10n ** 6n;

type PotProps = {
  title: string;
  rType: 0 | 1 | 2 | 3;
  onCoinInsert?: () => void;
  pulseToken?: number;
  wrongNetwork: boolean;
  hasAddresses: boolean;
};

function shortAddr(a?: `0x${string}`) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

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

function Pot({ title, rType, onCoinInsert, pulseToken, wrongNetwork, hasAddresses }: PotProps) {
  const { address } = useAccount();
  const [tickets, setTickets] = React.useState("1");

  const [pulse, setPulse] = React.useState(false);
  React.useEffect(() => {
    if (!pulseToken) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 360);
    return () => clearTimeout(t);
  }, [pulseToken]);

  const ticketsNum = Number(tickets);
  const safeTicketsNum = Number.isFinite(ticketsNum) && ticketsNum >= 1 ? Math.floor(ticketsNum) : 1;

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

  const { data: last } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "getLastResult",
    args: [rType],
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const roundId = round ? round[0] : 0n;
  const targetPot = round ? round[1] : 0n;
  const deposited = round ? round[2] : 0n;
  const totalTickets = round ? round[3] : 0;
  const drawing = round ? round[4] : false;

  const remainingUSDC = targetPot > deposited ? targetPot - deposited : 0n;
  const remainingTickets = remainingUSDC / TICKET_PRICE;
  const progressPct = targetPot > 0n ? Number((deposited * 100n) / targetPot) : 0;

  const lastRoundId = last ? last[0] : 0n;
  const w1 = (last ? last[1] : undefined) as `0x${string}` | undefined;
  const w2 = (last ? last[2] : undefined) as `0x${string}` | undefined;
  const w3 = (last ? last[3] : undefined) as `0x${string}` | undefined;

  const p1 = last ? last[4] : 0n;
  const p2 = last ? last[5] : 0n;
  const p3 = last ? last[6] : 0n;

  const { data: allowance } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: addresses.usdc,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", addresses.manager],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });

  const allowanceValue = allowance ?? 0n;
  const needsApproval = !address || allowanceValue < cost;

  const { writeContractAsync, isPending } = useWriteContract();

  async function approve() {
    if (!address || wrongNetwork || !hasAddresses) return;
    await writeContractAsync({
      chainId: REQUIRED_CHAIN_ID,
      abi: erc20Abi,
      address: addresses.usdc,
      functionName: "approve",
      args: [addresses.manager, cost],
    });
  }

  async function depositFn() {
    if (!address || wrongNetwork || !hasAddresses) return;

    onCoinInsert?.();
    try {
      if (navigator.vibrate) navigator.vibrate(25);
    } catch {}

    await writeContractAsync({
      chainId: REQUIRED_CHAIN_ID,
      abi: raffleManagerAbi,
      address: addresses.manager,
      functionName: "deposit",
      args: [rType, ticketCount],
    });
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
        <input className="input mt-1" value={tickets} onChange={(e) => setTickets(e.target.value)} type="number" min={1} />
        <div className="muted text-[10px] mt-2">COST: {formatUnits(cost, USDC_DECIMALS)} USDC</div>
      </div>

      {wrongNetwork && <div className="danger text-[10px] mt-2">SWITCH TO BASE SEPOLIA (CHAIN {REQUIRED_CHAIN_ID})</div>}

      <div className="mt-3 flex gap-2">
        <button className="btn btnMint flex-1" onClick={approve} disabled={!address || wrongNetwork || !hasAddresses || isPending}>
          APPROVE
        </button>

        <button
          className="btn btnGold flex-1"
          onClick={depositFn}
          disabled={!address || wrongNetwork || !hasAddresses || needsApproval || drawing || isPending || ticketCount > remainingTickets}
        >
          DEPOSIT
        </button>
      </div>

      {!drawing && ticketCount > remainingTickets && (
        <div className="danger text-[10px] mt-2">TOO MANY. LEFT: {remainingTickets.toString()}</div>
      )}

      <div className="mt-4">
        <SlotWinners
          trigger={Number(lastRoundId)}
          lastRoundId={lastRoundId}
          w1={w1 ?? "0x0000000000000000000000000000000000000000"}
          w2={w2 ?? "0x0000000000000000000000000000000000000000"}
          w3={w3 ?? "0x0000000000000000000000000000000000000000"}
        />

        <div className="mt-3 inset statBox">
          <div className="muted text-[10px]">LATEST (R{lastRoundId.toString()})</div>
          <div className="muted text-[10px] mt-2">1ST: {shortAddr(w1)} • {formatUnits(p1, USDC_DECIMALS)} USDC</div>
          <div className="muted text-[10px] mt-1">2ND: {shortAddr(w2)} • {formatUnits(p2, USDC_DECIMALS)} USDC</div>
          <div className="muted text-[10px] mt-1">3RD: {shortAddr(w3)} • {formatUnits(p3, USDC_DECIMALS)} USDC</div>
        </div>
      </div>
    </div>
  );
}

export default function PlayPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  const hasAddresses = isAddress(addresses.manager) && isAddress(addresses.usdc);

  const [rainTrigger, setRainTrigger] = React.useState(0);
  const [pulseSmall, setPulseSmall] = React.useState(0);
  const [pulseMed, setPulseMed] = React.useState(0);
  const [pulseLarge, setPulseLarge] = React.useState(0);
  const [pulseMega, setPulseMega] = React.useState(0);

  // Claimable panel
  const { data: claimable } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "claimable",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2000 },
  });

  const claimableAmt = claimable ?? 0n;

  const { writeContractAsync, isPending } = useWriteContract();

  async function claimFn() {
    if (!address || wrongNetwork || !hasAddresses) return;
    await writeContractAsync({
      chainId: REQUIRED_CHAIN_ID,
      abi: raffleManagerAbi,
      address: addresses.manager,
      functionName: "claim",
      args: [],
    });
  }

  useWatchContractEvent({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    eventName: "Finalized",
    enabled: hasAddresses,
    onLogs: () => setRainTrigger((n) => n + 1),
  });

  return (
    <main className="screen" style={{ position: "relative" }}>
      <MoneyRain trigger={rainTrigger} />

      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="muted text-[10px]">
          PLAY AT YOUR OWN RISK • TICKETS ARE NON-REFUNDABLE ONCE PURCHASED • ROUND ONLY COMPLETES WHEN ALL TICKETS ARE SOLD
        </div>
      </div>

      {/* Claim panel */}
      <div className="panel px-5 py-3 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="h2">CLAIMABLE USDC</div>
            <div className="muted text-[10px] mt-1">{formatUnits(claimableAmt, USDC_DECIMALS)} USDC</div>
          </div>

          <button className="btn btnGold" onClick={claimFn} disabled={!address || wrongNetwork || !hasAddresses || isPending || claimableAmt === 0n}>
            CLAIM
          </button>
        </div>
        <div className="muted text-[10px] mt-2">
          Winners are paid via claim. For Medium/Large/Mega, runner-ups may be assigned in batches after the round finalizes.
        </div>
      </div>

      {!hasAddresses && (
        <div className="panel px-5 py-3 text-center mt-4">
          <div className="danger text-[10px]">CONFIG ERROR</div>
          <div className="muted text-[10px] mt-1">Missing NEXT_PUBLIC_MANAGER / NEXT_PUBLIC_USDC (or invalid addresses).</div>
        </div>
      )}

      {wrongNetwork && (
        <div className="panel px-5 py-3 text-center mt-4">
          <div className="danger text-[10px]">WRONG NETWORK</div>
          <div className="muted text-[10px] mt-1">Switch to Base Sepolia (Chain ID {REQUIRED_CHAIN_ID}) to buy tickets.</div>
        </div>
      )}

      <div className="mt-5 potRow">
        <Pot
          title="SMALL"
          rType={0}
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
