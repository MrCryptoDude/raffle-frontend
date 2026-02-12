"use client";

import * as React from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import {
  formatUnits,
  parseUnits,
  maxUint256,
  decodeEventLog,
  type Hash,
} from "viem";

import { addresses, REQUIRED_CHAIN_ID } from "../../lib/addresses";
import { erc20Abi, rpsManagerAbi } from "../../lib/abis";

const BRRR_DECIMALS = 18;

const MIN_BET = 10n * 10n ** 18n;
const MAX_BET = 25_000n * 10n ** 18n;

type Move = 0 | 1 | 2;

type Resolved = {
  gameId: bigint;
  playerMove: Move;
  houseMove: Move;
  outcome: number;
  bet: bigint;
  fee: bigint;
  payoutToPlayer: bigint;
  txHash?: Hash;
};

function shortAddr(a?: `0x${string}`) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function clampBetWei(x: bigint) {
  if (x < MIN_BET) return MIN_BET;
  if (x > MAX_BET) return MAX_BET;
  return x;
}

function outcomeToLabel(outcome?: number) {
  if (outcome === undefined || outcome === null) return "—";
  if (outcome === 0) return "PENDING";
  if (outcome === 1) return "YOU WIN";
  if (outcome === 2) return "HOUSE WINS";
  if (outcome === 3) return "DRAW";
  return `OUTCOME: ${outcome}`;
}

function moveToLabel(m?: number) {
  if (m === 0) return "ROCK";
  if (m === 1) return "PAPER";
  if (m === 2) return "SCISSORS";
  return "—";
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMatrixBlock(seed: number, rows = 12, cols = 22) {
  const rnd = mulberry32(seed);
  const alphabet = "0123456789ABCDEF$#%&@+*";
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let s = "";
    for (let c = 0; c < cols; c++) {
      s += alphabet[Math.floor(rnd() * alphabet.length)];
    }
    lines.push(s);
  }
  return lines;
}

function MatrixRpsIcon({
  side,
  move,
  isRevealing,
  seed,
}: {
  side: "player" | "house";
  move: Move;
  isRevealing: boolean;
  seed: number;
}) {
  const clipId = React.useMemo(() => `clip_${side}_${move}_${seed}`, [side, move, seed]);
  const glowId = React.useMemo(() => `glow_${side}_${seed}`, [side, seed]);

  const shape = React.useMemo(() => {
    if (move === 0) {
      return <path d="M22 72 L34 34 L54 18 L78 26 L96 52 L84 92 L54 104 L30 94 Z" />;
    }
    if (move === 1) {
      return (
        <>
          <path d="M30 14 H74 L92 32 V106 H30 Z" />
          <path d="M74 14 V32 H92" />
          <path d="M40 46 H82" />
          <path d="M40 58 H82" />
          <path d="M40 70 H78" />
          <path d="M40 82 H72" />
        </>
      );
    }
    return (
      <>
        <path d="M44 26 a12 12 0 1 0 0.1 0 Z" />
        <path d="M78 26 a12 12 0 1 0 0.1 0 Z" />
        <path d="M50 36 L70 62" />
        <path d="M72 36 L52 62" />
        <path d="M60 60 L32 106" />
        <path d="M60 60 L88 106" />
      </>
    );
  }, [move]);

  const lines = React.useMemo(() => makeMatrixBlock(seed, 12, 22), [seed]);

  return (
    <svg
      className="rpsIcon"
      viewBox="0 0 120 120"
      style={{ display: "block", filter: `url(#${glowId})` }}
      aria-label={`${side} ${moveToLabel(move)}`}
    >
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0.95 0"
            result="greenGlow"
          />
          <feMerge>
            <feMergeNode in="greenGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <clipPath id={clipId}>
          {move === 1 ? <path d="M30 14 H74 L92 32 V106 H30 Z" /> : shape}
        </clipPath>

        <pattern id={`scan_${side}_${seed}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0H6" stroke="rgba(0,255,140,0.12)" strokeWidth="1" />
        </pattern>
      </defs>

      <g fill="none" stroke="rgba(0,255,140,0.95)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {shape}
      </g>

      <g fill="none" stroke="rgba(0,255,140,0.35)" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round">
        {shape}
      </g>

      <g clipPath={`url(#${clipId})`} opacity={isRevealing ? 1 : 0.82}>
        <rect x="0" y="0" width="120" height="120" fill="rgba(0,0,0,0.25)" />
        <g className={isRevealing ? "matrixFloat" : "matrixFloatSlow"}>
          {lines.map((ln, i) => (
            <text
              key={i}
              x={-6}
              y={18 + i * 9}
              fontFamily='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              fontSize="10"
              fill="rgba(0,255,140,0.9)"
              letterSpacing="1.5"
            >
              {ln}
            </text>
          ))}
        </g>
        <rect x="0" y="0" width="120" height="120" fill={`url(#scan_${side}_${seed})`} opacity="0.6" />
        <rect x="0" y="0" width="120" height="120" fill="rgba(0,0,0,0.12)" />
      </g>

      <text
        x={6}
        y={112}
        fontFamily='ui-monospace, monospace'
        fontSize="10"
        fill="rgba(0,255,140,0.75)"
        letterSpacing="1.2"
      >
        {side === "player" ? "P" : "H"}
      </text>
    </svg>
  );
}

export default function RpsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingNetwork } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  const publicClient = usePublicClient({ chainId: REQUIRED_CHAIN_ID });
  const { writeContractAsync, isPending } = useWriteContract();

  const [betInput, setBetInput] = React.useState<string>("10");
  const [status, setStatus] = React.useState<string>("");
  const [selectedMove, setSelectedMove] = React.useState<Move | null>(null);

  const [pendingGameId, setPendingGameId] = React.useState<bigint | null>(null);
  const [playerMove, setPlayerMove] = React.useState<Move>(0);
  const [houseMove, setHouseMove] = React.useState<Move>(0);

  const [isRevealing, setIsRevealing] = React.useState(false);
  const [playerSeed, setPlayerSeed] = React.useState(1);
  const [houseSeed, setHouseSeed] = React.useState(2);

  const [resolved, setResolved] = React.useState<Resolved | null>(null);

  const brrrToken = addresses.raffle;

  const betWei = React.useMemo(() => {
    try {
      const v = parseUnits(betInput === "" ? "0" : betInput, BRRR_DECIMALS);
      if (v === 0n) return 0n;
      return clampBetWei(v);
    } catch {
      return 0n;
    }
  }, [betInput]);

  const betPretty = betWei > 0n ? formatUnits(betWei, BRRR_DECIMALS) : "0";

  function setEphemeralStatus(msg: string, ms = 6500) {
    setStatus(msg);
    if (ms > 0) setTimeout(() => setStatus(""), ms);
  }

  async function ensureCorrectNetwork(): Promise<boolean> {
    if (!isConnected) return false;
    if (!wrongNetwork) return true;
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
      return true;
    } catch {
      setEphemeralStatus("Please switch to Base to continue.", 9000);
      return false;
    }
  }

  const allowanceQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: brrrToken,
    functionName: "allowance",
    args: [
      (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      addresses.rps,
    ],
    query: { enabled: !!address && !wrongNetwork, refetchInterval: 2000 },
  });

  const allowance = allowanceQ.data ?? 0n;
  const needsApproval = !!address && !wrongNetwork && betWei > 0n && allowance < betWei;
  const disableAll = !isConnected || isPending || isRevealing;
  const disableAction = disableAll || betWei === 0n;
  const approveEnabled = !disableAction && needsApproval && !pendingGameId;
  const moveSelectionEnabled = !disableAction && !needsApproval && !pendingGameId;
  const playEnabled = !disableAll && !needsApproval && selectedMove !== null && !pendingGameId;

  async function handleSwitchNetwork() {
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch {}
  }

  async function approve() {
    const networkOk = await ensureCorrectNetwork();
    if (!networkOk || !address) return;
    if (betWei < MIN_BET || betWei > MAX_BET) {
      setEphemeralStatus("ERROR: Bet out of range.");
      return;
    }

    try {
      setStatus("APPROVING BRRR…");
      const hash = await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: erc20Abi,
        address: brrrToken,
        functionName: "approve",
        args: [addresses.rps, maxUint256],
      });
      if (!publicClient) throw new Error("No public client");
      await publicClient.waitForTransactionReceipt({ hash });
      setEphemeralStatus(`APPROVED`, 9000);
    } catch (e: any) {
      setEphemeralStatus(`ERROR: ${e?.shortMessage || e?.message || "TX failed"}`, 12000);
    }
  }

  function selectMove(move: Move) {
    if (!moveSelectionEnabled) return;
    setSelectedMove(move);
    setPlayerMove(move);
  }

  function startRevealFlicker() {
    setIsRevealing(true);
    const id = setInterval(() => {
      setPlayerSeed((s) => (s + 1337) >>> 0);
      setHouseSeed((s) => (s + 4242) >>> 0);
      setHouseMove(Math.floor(Math.random() * 3) as Move);
    }, 120);

    return {
      stopWithFinal: (finalHouse: Move) => {
        clearInterval(id);
        setIsRevealing(false);
        setHouseMove(finalHouse);
        setPlayerSeed((s) => (s + 777) >>> 0);
        setHouseSeed((s) => (s + 999) >>> 0);
      },
      cancel: () => {
        clearInterval(id);
        setIsRevealing(false);
      },
    };
  }

  async function pollForSettlement(gameId: bigint): Promise<any> {
    if (!publicClient) throw new Error("No public client");
    // Poll for up to 120 seconds (VRF + Automation can take time on mainnet)
    for (let i = 0; i < 120; i++) {
      try {
        const g = (await publicClient.readContract({
          address: addresses.rps,
          abi: rpsManagerAbi,
          functionName: "games",
          args: [gameId],
        })) as any;
        // Game struct: player, bet, playerMove, houseMove, requestId, outcome, createdAt, resolvedAt, settled
        // Array indices: 0=player, 1=bet, 2=playerMove, 3=houseMove, 4=requestId, 5=outcome, 6=createdAt, 7=resolvedAt, 8=settled
        const settled = Boolean(g.settled ?? g[8]);
        if (settled) return g;
      } catch (err) {
        console.warn(`Poll attempt ${i} failed:`, err);
        // Continue polling even if one request fails
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Timeout waiting for settlement");
  }

  async function play() {
    const networkOk = await ensureCorrectNetwork();
    if (!networkOk || !address || selectedMove === null) return;

    if (betWei < MIN_BET || betWei > MAX_BET) {
      setEphemeralStatus("ERROR: Bet out of range.");
      return;
    }
    if (allowance < betWei) {
      setEphemeralStatus("ERROR: Approve first.");
      return;
    }

    const flicker = startRevealFlicker();

    try {
      setResolved(null);
      setStatus("PLAYING…");

      const hash = await writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: rpsManagerAbi,
        address: addresses.rps,
        functionName: "play",
        args: [betWei, selectedMove],
      });

      if (!publicClient) throw new Error("No public client");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let gid: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: rpsManagerAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "GameStarted") {
            const args = decoded.args as any;
            if (args?.gameId !== undefined) {
              gid = BigInt(args.gameId);
              break;
            }
          }
        } catch {}
      }

      if (!gid) {
        const gc = (await publicClient.readContract({
          address: addresses.rps,
          abi: rpsManagerAbi,
          functionName: "gameCount",
          args: [],
        })) as bigint;
        gid = gc;
      }

      setPendingGameId(gid);
      setStatus(`GAME #${gid.toString()} — Settling...`);

      const g = await pollForSettlement(gid);
      const bet = BigInt(g.bet ?? g[1]);
      const pm = Number(g.move ?? g.playerMove ?? g[2]) as Move;
      const hm = Number(g.houseMove ?? g[3]) as Move;
      const outcome = Number(g.outcome ?? g[5]) as number;

      const fee = (bet * 100n) / 10_000n;
      let payout = 0n;
      if (outcome === 3) {
        payout = bet - bet / 2n - fee;
      } else if (outcome === 1) {
        payout = bet * 2n - fee;
      }

      const got: Resolved = {
        gameId: gid,
        playerMove: pm,
        houseMove: hm,
        outcome,
        bet,
        fee,
        payoutToPlayer: payout,
        txHash: hash,
      };

      flicker.stopWithFinal(got.houseMove);
      setResolved(got);
      setPendingGameId(null);
      setSelectedMove(null);
      setEphemeralStatus(`GAME #${got.gameId.toString()} — ${outcomeToLabel(got.outcome)}`, 9000);
    } catch (e: any) {
      flicker.cancel();
      setPendingGameId(null);
      const msg = (e?.shortMessage || e?.message || "TX failed") as string;
      if (msg.toLowerCase().includes("timeout")) {
        setEphemeralStatus("Settlement taking longer than expected.", 12000);
      } else {
        setEphemeralStatus(`ERROR: ${msg}`, 12000);
      }
    }
  }

  const houseNet = React.useMemo(() => {
    if (!resolved) return null;
    return resolved.bet - resolved.fee - resolved.payoutToPlayer;
  }, [resolved]);

  return (
    <main className="screen">
      <style>{`
        @keyframes matrixFloat {
          0% { transform: translateY(0px); opacity: 0.95; }
          50% { transform: translateY(-6px); opacity: 1; }
          100% { transform: translateY(0px); opacity: 0.95; }
        }
        @keyframes matrixFloatSlow {
          0% { transform: translateY(0px); opacity: 0.85; }
          50% { transform: translateY(-2px); opacity: 0.9; }
          100% { transform: translateY(0px); opacity: 0.85; }
        }
        .matrixFloat { animation: matrixFloat 0.55s ease-in-out infinite; }
        .matrixFloatSlow { animation: matrixFloatSlow 2.0s ease-in-out infinite; }
        
        .rpsArena {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px;
          align-items: center;
          padding: 16px;
        }
        
        .rpsSide {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        
        .rpsIcon {
          width: 140px;
          height: 140px;
          max-width: 100%;
        }
        
        .rpsCenter {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
        }
        
        .rpsVs {
          font-size: 12px;
          letter-spacing: 0.2em;
          color: rgba(0,255,140,0.7);
        }
        
        .rpsDivider {
          width: 1px;
          height: 60px;
          background: linear-gradient(180deg, transparent, rgba(0,255,140,0.5), transparent);
        }
        
        .moveBtn {
          flex: 1;
          transition: all 0.2s ease;
        }
        .moveBtn.selected {
          box-shadow: 0 0 20px rgba(0, 255, 140, 0.5);
          transform: scale(1.02);
          border-color: rgba(0, 255, 140, 1);
        }
        
        @media (max-width: 600px) {
          .rpsArena {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto;
            gap: 12px;
            padding: 12px;
          }
          
          .rpsCenter {
            grid-column: 1 / -1;
            flex-direction: row;
            justify-content: center;
            order: -1;
            padding: 8px 0;
          }
          
          .rpsDivider {
            width: 40px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(0,255,140,0.5), transparent);
          }
          
          .rpsIcon {
            width: 100px;
            height: 100px;
          }
        }
        
        @media (max-width: 400px) {
          .rpsIcon {
            width: 80px;
            height: 80px;
          }
        }
      `}</style>

      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="h1">ROCK PAPER SCISSORS</div>
        <div className="muted tiny mt-2">1% FEE TO STAKERS</div>
        {status && <div className="muted tiny mt-2">{status}</div>}
        {wrongNetwork && (
          <div className="mt-2">
            <button className="btn btnGold" onClick={handleSwitchNetwork} disabled={isSwitchingNetwork}>
              {isSwitchingNetwork ? "SWITCHING..." : "SWITCH TO BASE"}
            </button>
          </div>
        )}
      </div>

      {/* Arena */}
      <div className="panel mt-4 rpsArena">
        <div className="rpsSide">
          <div className="muted tiny">PLAYER</div>
          <div className="tiny" style={{ opacity: 0.7 }}>{address ? shortAddr(address) : "—"}</div>
          <div style={{ marginTop: 8 }}>
            <MatrixRpsIcon side="player" move={playerMove} isRevealing={isRevealing} seed={playerSeed} />
          </div>
          <div className="muted tiny mt-2">{moveToLabel(playerMove)}</div>
        </div>

        <div className="rpsCenter">
          <div className="rpsVs">{isRevealing ? "⚡" : "VS"}</div>
          <div className="rpsDivider" />
          <div className="tiny" style={{ color: "rgba(0,255,140,0.6)" }}>
            {isRevealing ? "SETTLING" : pendingGameId ? `#${pendingGameId}` : "READY"}
          </div>
        </div>

        <div className="rpsSide">
          <div className="muted tiny">HOUSE</div>
          <div className="tiny" style={{ opacity: 0.7 }}>TREASURY</div>
          <div style={{ marginTop: 8 }}>
            <MatrixRpsIcon side="house" move={houseMove} isRevealing={isRevealing} seed={houseSeed} />
          </div>
          <div className="muted tiny mt-2">{moveToLabel(houseMove)}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="panel potCard cabinetPot mt-4" style={{ maxWidth: 560, margin: "16px auto 0" }}>
        <div className="h2 text-center">PLAY</div>

        <div className="mt-3 inset statBox">
          <div className="muted tiny">BET AMOUNT (BRRR)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input
              className="input"
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
              disabled={disableAll || !!pendingGameId}
              inputMode="decimal"
              placeholder="10"
              style={{ flex: 1 }}
            />
            <span className="muted tiny">10–25k</span>
          </div>
        </div>

        {needsApproval && (
          <div className="mt-3">
            <button className="btn btnMint w-full" onClick={approve} disabled={!approveEnabled}>
              APPROVE BRRR
            </button>
          </div>
        )}

        <div className="mt-3">
          <div className="muted tiny text-center mb-2">CHOOSE YOUR MOVE</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`btn btnGold moveBtn ${selectedMove === 0 ? "selected" : ""}`}
              onClick={() => selectMove(0)}
              disabled={!moveSelectionEnabled}
            >
              🪨 ROCK
            </button>
            <button
              className={`btn btnGold moveBtn ${selectedMove === 1 ? "selected" : ""}`}
              onClick={() => selectMove(1)}
              disabled={!moveSelectionEnabled}
            >
              📄 PAPER
            </button>
            <button
              className={`btn btnGold moveBtn ${selectedMove === 2 ? "selected" : ""}`}
              onClick={() => selectMove(2)}
              disabled={!moveSelectionEnabled}
            >
              ✂️ SCISSORS
            </button>
          </div>
        </div>

        <div className="mt-3">
          <button className="btn btnBlue w-full" onClick={play} disabled={!playEnabled}>
            {isRevealing ? "SETTLING..." : "🎮 PLAY"}
          </button>
        </div>

        {resolved && (
          <div className="mt-4 inset statBox">
            <div
              className="h2 text-center"
              style={{
                color: resolved.outcome === 1 ? "#00ff8c" : resolved.outcome === 2 ? "#ff6b6b" : "#ffd700",
              }}
            >
              {outcomeToLabel(resolved.outcome)}
            </div>
            <div className="tiny mt-2 text-center">
              {moveToLabel(resolved.playerMove)} vs {moveToLabel(resolved.houseMove)}
            </div>
            <div className="muted tiny mt-3">
              Bet: {formatUnits(resolved.bet, BRRR_DECIMALS)} BRRR
            </div>
            <div className="muted tiny">
              Payout: {formatUnits(resolved.payoutToPlayer, BRRR_DECIMALS)} BRRR
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
