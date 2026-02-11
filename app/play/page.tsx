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
          {drawing ? "🎲 DRAWING WINNERS..." : "OPEN"} • {progressPct}% FILLED
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
          SWITCH TO BASE (CHAIN {REQUIRED_CHAIN_ID})
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

// Matrix-style encrypted display - always shows random characters
function MatrixEncrypted({ hasWinnings }: { hasWinnings: boolean }) {
  const [columns, setColumns] = React.useState<string[][]>([]);
  const matrixChars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789$¢£¥€₿ABCDEF";
  const numColumns = 12;
  const numRows = 3;

  React.useEffect(() => {
    if (!hasWinnings) {
      setColumns([]);
      return;
    }

    // Initialize columns
    const initCols = Array.from({ length: numColumns }, () =>
      Array.from({ length: numRows }, () => 
        matrixChars[Math.floor(Math.random() * matrixChars.length)]
      )
    );
    setColumns(initCols);

    // Animate - random characters falling
    const interval = setInterval(() => {
      setColumns(prev => 
        prev.map(col => {
          // Shift down and add new char at top
          const newCol = [...col];
          // Random chance to update each cell
          return newCol.map(() => 
            Math.random() > 0.7 
              ? matrixChars[Math.floor(Math.random() * matrixChars.length)]
              : newCol[Math.floor(Math.random() * numRows)]
          );
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [hasWinnings]);

  if (!hasWinnings) return null;

  return (
    <div style={{
      display: "flex",
      gap: 2,
      justifyContent: "center",
      padding: "8px 0",
      background: "rgba(0,0,0,0.4)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {columns.map((col, i) => (
        <div key={i} style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
        }}>
          {col.map((char, j) => (
            <span
              key={j}
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                fontWeight: 700,
                color: j === 0 
                  ? "rgba(0,255,140,1)" 
                  : j === 1 
                    ? "rgba(0,255,140,0.7)" 
                    : "rgba(0,255,140,0.3)",
                textShadow: j === 0 ? "0 0 10px rgba(0,255,140,0.8)" : "none",
                lineHeight: 1.2,
              }}
            >
              {char}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

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

  // Claim state
  const [claimPending, setClaimPending] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [lastClaimAmount, setLastClaimAmount] = React.useState(0n);

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

  async function claimFn() {
    if (!address || wrongNetwork || !hasAddresses) return;
    if (totalClaimable === 0n) return;

    const claimAmount = totalClaimable;

    try {
      setClaimPending(true);
      await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: raffleManagerAbi,
        address: addresses.manager,
        functionName: "claim",
        args: [],
      });
      
      // Show success
      setLastClaimAmount(claimAmount);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 8000);
    } catch {
      // ignore
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

      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="muted text-[10px]">
          🎰 FULLY AUTOMATED • CHAINLINK VRF DRAWS WINNERS • CHAINLINK AUTOMATION SETTLES ROUNDS • JUST BUY TICKETS & CLAIM
        </div>
      </div>

      {/* Claim Panel */}
      <div className="panel px-5 py-4 mt-4" style={{
        background: totalClaimable > 0n 
          ? "linear-gradient(135deg, rgba(0,20,10,0.9) 0%, rgba(0,40,20,0.8) 100%)"
          : undefined,
        border: totalClaimable > 0n ? "1px solid rgba(0,255,140,0.4)" : undefined,
        boxShadow: totalClaimable > 0n ? "0 0 30px rgba(0,255,140,0.1), inset 0 0 60px rgba(0,255,140,0.05)" : undefined,
      }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div style={{ flex: 1 }}>
            <div className="muted text-[10px] mb-2" style={{ letterSpacing: 2 }}>
              {totalClaimable > 0n ? "⚡ WINNINGS DETECTED" : "YOUR WINNINGS"}
            </div>
            
            {/* Matrix animation when there are winnings */}
            <MatrixEncrypted hasWinnings={totalClaimable > 0n && !showSuccess} />
            
            {/* Show nothing when no winnings and not success */}
            {totalClaimable === 0n && !showSuccess && (
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: "rgba(255,255,255,0.2)",
                padding: "12px 0",
              }}>
                —
              </div>
            )}
            
            {refundsAmt > 0n && !showSuccess && (
              <div className="muted text-[10px] mt-2">
                + {formatUnits(refundsAmt, USDC_DECIMALS)} USDC refunds available
              </div>
            )}

            {showSuccess && (
              <div style={{
                marginTop: 8,
                padding: "16px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(0,255,140,0.2) 0%, rgba(0,200,100,0.1) 100%)",
                border: "1px solid rgba(0,255,140,0.5)",
              }}>
                <div style={{ 
                  color: "rgba(0,255,140,1)", 
                  fontWeight: 800, 
                  fontSize: 14,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}>
                  ✓ CLAIMED SUCCESSFULLY
                </div>
                <div style={{ 
                  color: "rgba(255,255,255,0.9)", 
                  fontWeight: 700, 
                  fontSize: 22,
                }}>
                  {formatUnits(lastClaimAmount, USDC_DECIMALS)} USDC
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btnGold"
            onClick={claimFn}
            disabled={
              !address ||
              wrongNetwork ||
              !hasAddresses ||
              claimPending ||
              totalClaimable === 0n
            }
            style={{
              padding: "18px 36px",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 1,
              opacity: totalClaimable === 0n ? 0.4 : 1,
              boxShadow: totalClaimable > 0n ? "0 0 20px rgba(255,200,100,0.3)" : undefined,
            }}
          >
            {claimPending ? "⏳ CLAIMING..." : totalClaimable > 0n ? "💰 CLAIM" : "NO WINNINGS"}
          </button>
        </div>

        <div className="muted text-[10px] mt-3" style={{ opacity: 0.6 }}>
          Rounds settle automatically via Chainlink. When you win, claim your USDC here.
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
            Switch to Base (Chain ID {REQUIRED_CHAIN_ID}) to buy tickets.
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
