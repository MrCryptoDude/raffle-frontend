"use client";

import * as React from "react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { formatUnits } from "viem";

import { addresses, USDC_DECIMALS, REQUIRED_CHAIN_ID } from "../../lib/addresses";
import { raffleManagerAbi } from "../../lib/abis";

type RType = 0 | 1 | 2 | 3;
type GameTab = "raffle" | "rps" | "gas";

const GAS_MARKET_ADDRESS = 
  (process.env.NEXT_PUBLIC_GAS_PREDICTION_MARKET as `0x${string}` | undefined) ??
  ("0x21f7e87206F13D4Ac70b205C329EB42a17f5FB53" as const);

const gasMarketAbi = [
  {
    type: "function",
    name: "gameResult",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "settled", type: "bool" },
      { name: "outcome", type: "uint8" },
      { name: "strikeWei", type: "uint64" },
      { name: "settlementWei", type: "uint64" },
      { name: "longPool", type: "uint128" },
      { name: "shortPool", type: "uint128" },
    ],
  },
  { type: "function", name: "userLong", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "uint128" }] },
  { type: "function", name: "userShort", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "uint128" }] },
  { type: "function", name: "claimable", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claimed", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

function shortAddr(a?: `0x${string}`) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const OutcomeLabels: Record<number, string> = {
  0: "Unset",
  1: "Long Win 📈",
  2: "Short Win 📉",
  3: "Push 🤝",
  4: "Cancelled ❌",
};

export default function HistoryPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  
  const [gameTab, setGameTab] = React.useState<GameTab>("raffle");
  const [rType, setRType] = React.useState<RType>(0);
  const [offset, setOffset] = React.useState(0n);
  const limit = 10n;

  // Raffle history
  const { data: raffleData, isLoading: raffleLoading, refetch: refetchRaffle } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "getHistory",
    args: [rType, offset, limit],
    query: { refetchInterval: 4000, enabled: gameTab === "raffle" },
  });

  const raffleRows = (raffleData ?? []) as any[];

  // Gas history - scan user's games from localStorage
  const [gasGames, setGasGames] = React.useState<any[]>([]);
  const [gasLoading, setGasLoading] = React.useState(false);

  React.useEffect(() => {
    if (gameTab !== "gas" || !address || !publicClient) {
      setGasGames([]);
      return;
    }

    let cancelled = false;

    async function loadGasHistory() {
      setGasLoading(true);
      
      // Load tracked game IDs from localStorage
      const storageKey = `gasGames:${address!.toLowerCase()}`;
      let gameIds: bigint[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          gameIds = JSON.parse(raw).map((id: string) => BigInt(id));
        }
      } catch {}

      const results: any[] = [];

      for (const gameId of gameIds.slice(-20).reverse()) { // Last 20, newest first
        if (cancelled) break;
        try {
          const [resultData, userLongData, userShortData, claimableData, claimedData] = await Promise.all([
            publicClient!.readContract({
              address: GAS_MARKET_ADDRESS,
              abi: gasMarketAbi,
              functionName: "gameResult",
              args: [gameId],
            }),
            publicClient!.readContract({
              address: GAS_MARKET_ADDRESS,
              abi: gasMarketAbi,
              functionName: "userLong",
              args: [gameId, address!],
            }),
            publicClient!.readContract({
              address: GAS_MARKET_ADDRESS,
              abi: gasMarketAbi,
              functionName: "userShort",
              args: [gameId, address!],
            }),
            publicClient!.readContract({
              address: GAS_MARKET_ADDRESS,
              abi: gasMarketAbi,
              functionName: "claimable",
              args: [gameId, address!],
            }),
            publicClient!.readContract({
              address: GAS_MARKET_ADDRESS,
              abi: gasMarketAbi,
              functionName: "claimed",
              args: [gameId, address!],
            }),
          ]);

          const [settled, outcome, strikeWei, settlementWei, longPool, shortPool] = resultData as [boolean, number, bigint, bigint, bigint, bigint];
          const userLong = userLongData as bigint;
          const userShort = userShortData as bigint;
          const claimable = claimableData as bigint;
          const claimed = claimedData as boolean;

          // Only include games where user participated
          if (userLong > 0n || userShort > 0n) {
            results.push({
              gameId,
              settled,
              outcome,
              strikeWei,
              settlementWei,
              longPool,
              shortPool,
              userLong,
              userShort,
              claimable,
              claimed,
            });
          }
        } catch {}
      }

      if (!cancelled) {
        setGasGames(results);
        setGasLoading(false);
      }
    }

    loadGasHistory();
    return () => { cancelled = true; };
  }, [gameTab, address, publicClient]);

  function loadMore() {
    setOffset((o) => o + limit);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid",
    borderColor: active ? "rgba(0,255,140,0.4)" : "rgba(255,255,255,0.1)",
    backgroundColor: active ? "rgba(0,255,140,0.15)" : "transparent",
    color: active ? "rgba(170,255,220,0.95)" : "rgba(255,255,255,0.6)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  });

  return (
    <main className="screen">
      <div className="panel px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="h2">HISTORY</div>
            <div className="muted text-[10px] mt-1">
              View your game history and results.
            </div>
          </div>

          {/* Game Type Tabs */}
          <div className="flex gap-2">
            <button style={tabStyle(gameTab === "raffle")} onClick={() => { setGameTab("raffle"); setOffset(0n); }}>
              🎰 Raffle
            </button>
            <button style={tabStyle(gameTab === "rps")} onClick={() => { setGameTab("rps"); setOffset(0n); }}>
              ✊ RPS
            </button>
            <button style={tabStyle(gameTab === "gas")} onClick={() => { setGameTab("gas"); setOffset(0n); }}>
              ⛽ Gas
            </button>
          </div>
        </div>

        {/* Raffle sub-filters */}
        {gameTab === "raffle" && (
          <div className="flex gap-2 mt-3">
            <select
              className="input"
              value={rType}
              onChange={(e) => {
                setOffset(0n);
                setRType(Number(e.target.value) as RType);
                setTimeout(() => refetchRaffle(), 0);
              }}
            >
              <option value={0}>SMALL</option>
              <option value={1}>MEDIUM</option>
              <option value={2}>LARGE</option>
              <option value={3}>MEGA</option>
            </select>
            <button className="btn btnMint" onClick={() => refetchRaffle()}>
              REFRESH
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {/* RAFFLE HISTORY */}
        {gameTab === "raffle" && (
          <>
            {raffleLoading && (
              <div className="panel px-5 py-3">
                <div className="muted text-[10px]">Loading…</div>
              </div>
            )}

            {!raffleLoading && raffleRows.length === 0 && (
              <div className="panel px-5 py-3">
                <div className="muted text-[10px]">No history yet.</div>
              </div>
            )}

            {raffleRows.map((r, idx) => {
              const roundId = r.roundId as bigint;
              const w1 = r.w1 as `0x${string}`;
              const w2 = r.w2 as `0x${string}`;
              const w3 = r.w3 as `0x${string}`;
              const p1 = r.p1 as bigint;
              const p2 = r.p2 as bigint;
              const p3 = r.p3 as bigint;
              const runnerEach = r.runnerEach as bigint;
              const winnersTotal = Number(r.winnersTotal as bigint);
              const stakersPaid = r.stakersPaid as bigint;
              const ts = Number(r.timestamp as bigint) * 1000;

              return (
                <div className="panel px-5 py-4" key={`${offset.toString()}-${idx}`}>
                  <div className="flex items-center justify-between">
                    <div className="h2">R{roundId.toString()}</div>
                    <div className="muted text-[10px]">
                      {Number.isFinite(ts) ? new Date(ts).toLocaleString() : "—"}
                    </div>
                  </div>

                  <div className="mt-3 inset statBox">
                    <div className="muted text-[10px]">TOP 3</div>
                    <div className="muted text-[10px] mt-2">
                      1ST: {shortAddr(w1)} • {formatUnits(p1, USDC_DECIMALS)} USDC
                    </div>
                    <div className="muted text-[10px] mt-1">
                      2ND: {shortAddr(w2)} • {formatUnits(p2, USDC_DECIMALS)} USDC
                    </div>
                    <div className="muted text-[10px] mt-1">
                      3RD: {shortAddr(w3)} • {formatUnits(p3, USDC_DECIMALS)} USDC
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="inset statBox">
                      <div className="muted text-[10px]">RUNNER EACH</div>
                      <div className="h2">{formatUnits(runnerEach, USDC_DECIMALS)} USDC</div>
                    </div>
                    <div className="inset statBox">
                      <div className="muted text-[10px]">WINNERS</div>
                      <div className="h2">{winnersTotal}</div>
                    </div>
                  </div>

                  <div className="mt-3 inset statBox">
                    <div className="muted text-[10px]">STAKERS PAID</div>
                    <div className="h2">{formatUnits(stakersPaid, USDC_DECIMALS)} USDC</div>
                  </div>
                </div>
              );
            })}

            <div className="panel px-5 py-3 flex justify-center">
              <button className="btn btnGold" onClick={loadMore}>
                LOAD MORE
              </button>
            </div>
          </>
        )}

        {/* RPS HISTORY */}
        {gameTab === "rps" && (
          <div className="panel px-5 py-4">
            <div className="muted text-[10px]">RPS history coming soon…</div>
          </div>
        )}

        {/* GAS PREDICTION HISTORY */}
        {gameTab === "gas" && (
          <>
            {!address && (
              <div className="panel px-5 py-3">
                <div className="muted text-[10px]">Connect wallet to view your gas prediction history.</div>
              </div>
            )}

            {address && gasLoading && (
              <div className="panel px-5 py-3">
                <div className="muted text-[10px]">Loading…</div>
              </div>
            )}

            {address && !gasLoading && gasGames.length === 0 && (
              <div className="panel px-5 py-3">
                <div className="muted text-[10px]">No gas prediction games found. Place a bet to get started!</div>
              </div>
            )}

            {gasGames.map((g, idx) => {
              const userSide = g.userLong > 0n ? "LONG" : "SHORT";
              const userBet = g.userLong > 0n ? g.userLong : g.userShort;
              const didWin = 
                (g.outcome === 1 && g.userLong > 0n) || 
                (g.outcome === 2 && g.userShort > 0n) ||
                g.outcome === 3 || g.outcome === 4; // Push or Cancelled = refund

              return (
                <div className="panel px-5 py-4" key={idx}>
                  <div className="flex items-center justify-between">
                    <div className="h2">Game #{g.gameId.toString()}</div>
                    <div style={{ 
                      padding: "4px 8px", 
                      borderRadius: 6, 
                      fontSize: 10,
                      fontWeight: 700,
                      backgroundColor: g.settled 
                        ? (didWin ? "rgba(0,255,140,0.15)" : "rgba(255,100,100,0.15)")
                        : "rgba(255,200,100,0.15)",
                      color: g.settled 
                        ? (didWin ? "rgba(100,255,150,0.95)" : "rgba(255,150,150,0.95)")
                        : "rgba(255,200,100,0.95)",
                    }}>
                      {g.settled ? (didWin ? "WON" : "LOST") : "PENDING"}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="inset statBox">
                      <div className="muted text-[10px]">YOUR BET</div>
                      <div className="h2" style={{ color: userSide === "LONG" ? "rgba(100,255,150,0.95)" : "rgba(255,120,120,0.95)" }}>
                        {formatUnits(userBet, USDC_DECIMALS)} USDC {userSide}
                      </div>
                    </div>
                    <div className="inset statBox">
                      <div className="muted text-[10px]">OUTCOME</div>
                      <div className="h2" style={{ fontSize: 14 }}>{OutcomeLabels[g.outcome] ?? "—"}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="inset statBox">
                      <div className="muted text-[10px]">STRIKE</div>
                      <div className="h2">{(Number(g.strikeWei) / 1e9).toFixed(4)} gwei</div>
                    </div>
                    <div className="inset statBox">
                      <div className="muted text-[10px]">SETTLEMENT</div>
                      <div className="h2">{g.settled ? `${(Number(g.settlementWei) / 1e9).toFixed(4)} gwei` : "—"}</div>
                    </div>
                  </div>

                  {g.settled && (
                    <div className="mt-3 inset statBox">
                      <div className="muted text-[10px]">PAYOUT</div>
                      <div className="h2" style={{ color: g.claimed ? "rgba(255,255,255,0.5)" : "rgba(100,255,150,0.95)" }}>
                        {g.claimed 
                          ? `${formatUnits(userBet, USDC_DECIMALS)} USDC (Claimed)` 
                          : g.claimable > 0n 
                            ? `${formatUnits(g.claimable, USDC_DECIMALS)} USDC (Claimable)`
                            : "0 USDC"
                        }
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
