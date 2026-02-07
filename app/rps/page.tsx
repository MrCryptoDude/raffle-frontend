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

const MIN_BET = 10n * 10n ** 18n; // 10 BRRR
const MAX_BET = 25_000n * 10n ** 18n; // 25,000 BRRR

type Move = 0 | 1 | 2; // 0 rock, 1 paper, 2 scissors

type Resolved = {
  gameId: bigint;
  playerMove: Move;
  houseMove: Move;
  outcome: number; // 0 Pending, 1 PlayerWin, 2 HouseWin, 3 Tie
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

/** deterministic PRNG from seed */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** generate matrix text block (rows x cols) */
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

/**
 * Neon, hollow "object" icons (Rock / Paper / Scissors)
 * with matrix decoding fill clipped into the silhouette.
 */
function MatrixRpsIcon({
  side,
  move,
  isRevealing,
  seed,
  size = 210,
}: {
  side: "player" | "house";
  move: Move;
  isRevealing: boolean;
  seed: number;
  size?: number;
}) {
  const clipId = React.useMemo(() => `clip_${side}_${move}`, [side, move]);
  const glowId = React.useMemo(() => `glow_${side}`, [side]);

  // 120x120 viewBox silhouettes
  const shape = React.useMemo(() => {
    // ROCK: faceted crystal polygon
    if (move === 0) {
      return <path d="M22 72 L34 34 L54 18 L78 26 L96 52 L84 92 L54 104 L30 94 Z" />;
    }
    // PAPER: sheet with folded corner + inner lines
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
    // SCISSORS: stylized scissors silhouette
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
      width={size}
      height={size}
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
            values="
              0 0 0 0 0
              0 1 0 0 0
              0 0 0 0 0
              0 0 0 0.95 0
            "
            result="greenGlow"
          />
          <feMerge>
            <feMergeNode in="greenGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <clipPath id={clipId}>
          {/* For PAPER we want the outer sheet only in the clip */}
          {move === 1 ? <path d="M30 14 H74 L92 32 V106 H30 Z" /> : shape}
        </clipPath>

        <pattern id={`scan_${side}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0H6" stroke="rgba(0,255,140,0.12)" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Outline */}
      <g
        fill="none"
        stroke="rgba(0,255,140,0.95)"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {shape}
      </g>

      {/* Inner faint outline */}
      <g
        fill="none"
        stroke="rgba(0,255,140,0.35)"
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {shape}
      </g>

      {/* Matrix fill clipped into silhouette */}
      <g clipPath={`url(#${clipId})`} opacity={isRevealing ? 1 : 0.82}>
        <rect x="0" y="0" width="120" height="120" fill="rgba(0,0,0,0.25)" />
        <g className={isRevealing ? "matrixFloat" : "matrixFloatSlow"}>
          {lines.map((ln, i) => (
            <text
              key={i}
              x={-6}
              y={18 + i * 9}
              fontFamily='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              fontSize="10"
              fill="rgba(0,255,140,0.9)"
              letterSpacing="1.5"
            >
              {ln}
            </text>
          ))}
        </g>
        <rect x="0" y="0" width="120" height="120" fill={`url(#scan_${side})`} opacity="0.6" />
        <rect x="0" y="0" width="120" height="120" fill="rgba(0,0,0,0.12)" />
      </g>

      {/* Tag */}
      <text
        x={6}
        y={112}
        fontFamily='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
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

  // BRRR token is addresses.raffle (NEXT_PUBLIC_RAFFLE)
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

  // Helper to ensure correct network before any action
  async function ensureCorrectNetwork(): Promise<boolean> {
    if (!isConnected) return false;
    if (!wrongNetwork) return true;
    
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
      return true;
    } catch (e) {
      console.error("Failed to switch network:", e);
      setEphemeralStatus("Please switch to Base Sepolia to continue.", 9000);
      return false;
    }
  }

  // Allowance BRRR -> RPS (spender is addresses.rps)
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

  // Button states
  const approveEnabled = !disableAction && needsApproval && !pendingGameId;
  const moveSelectionEnabled = !disableAction && !needsApproval && !pendingGameId;
  const playEnabled = !disableAll && !needsApproval && selectedMove !== null && !pendingGameId;

  async function handleSwitchNetwork() {
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch (e) {
      console.error("Switch network failed:", e);
    }
  }

  async function approve() {
    const networkOk = await ensureCorrectNetwork();
    if (!networkOk) return;

    if (!address) return;
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

      setEphemeralStatus(`APPROVED (tx: ${hash.slice(0, 10)}…)`, 9000);
    } catch (e: any) {
      setEphemeralStatus(`ERROR: ${e?.shortMessage || e?.message || "TX failed"}`, 12000);
      console.error(e);
    }
  }

  function selectMove(move: Move) {
    if (!moveSelectionEnabled) return;
    setSelectedMove(move);
    setPlayerMove(move);
  }

  // Start matrix flickering animation
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

  // Poll for game settlement
  async function pollForSettlement(gameId: bigint): Promise<any> {
    if (!publicClient) throw new Error("No public client");

    for (let i = 0; i < 60; i++) { // Poll for up to 60 seconds
      const g = (await publicClient.readContract({
        address: addresses.rps,
        abi: rpsManagerAbi,
        functionName: "games",
        args: [gameId],
      })) as any;

      const settled = Boolean(g.settled ?? g[8]);
      if (settled) {
        return g;
      }

      // Wait 1 second before next poll
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error("Timeout waiting for settlement");
  }

  // Single Play action: play() then wait for automation to settle
  async function play() {
    const networkOk = await ensureCorrectNetwork();
    if (!networkOk) return;

    if (!address || selectedMove === null) return;

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

      // Decode GameStarted for gameId
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
        } catch {
          // ignore non-matching logs
        }
      }

      if (!gid) {
        // fallback: read gameCount
        const gc = (await publicClient.readContract({
          address: addresses.rps,
          abi: rpsManagerAbi,
          functionName: "gameCount",
          args: [],
        })) as bigint;
        gid = gc;
      }

      setPendingGameId(gid);
      setStatus(`GAME #${gid.toString()} — Waiting for settlement...`);

      // Poll for settlement (Chainlink Automation will settle it)
      const g = await pollForSettlement(gid);

      // Parse game result
      const bet = BigInt(g.bet ?? g[1]);
      const pm = Number(g.move ?? g.playerMove ?? g[2]) as Move;
      const hm = Number(g.houseMove ?? g[3]) as Move;
      const outcome = Number(g.outcome ?? g[5]) as number;

      // Economics
      const fee = (bet * 100n) / 10_000n; // 1%
      let payout = 0n;
      if (outcome === 3) {
        const houseTake = bet / 2n;
        payout = bet - houseTake - fee;
      } else if (outcome === 1) {
        payout = bet * 2n - fee;
      } else {
        payout = 0n;
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

      const msg = (e?.shortMessage || e?.message || "TX failed/cancelled") as string;
      if (msg.toLowerCase().includes("timeout")) {
        setEphemeralStatus("Settlement taking longer than expected. Check back soon.", 12000);
      } else {
        setEphemeralStatus(`ERROR: ${msg}`, 12000);
      }

      console.error(e);
    }
  }

  const houseNet = React.useMemo(() => {
    if (!resolved) return null;
    return resolved.bet - resolved.fee - resolved.payoutToPlayer;
  }, [resolved]);

  return (
    <main className="screen">
      <style>{`
        .rpsWrap { max-width: 1060px; margin: 18px auto 0; }
        .rpsHandsWrap { position: relative; overflow: hidden; }
        .rpsHandsRow { display:flex; align-items:center; justify-content:space-between; gap:18px; }
        .rpsSide { width: 42%; }
        .rpsCenter { width: 16%; text-align:center; }

        .rpsLabel {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          letter-spacing: 0.14em;
          opacity: 0.82;
          text-transform: uppercase;
        }
        .rpsAddress { opacity: 0.85; }

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

        .rpsCenterGlyph {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          letter-spacing:0.14em;
          opacity:0.82;
          white-space:nowrap;
        }

        .neonDivider {
          height: 1px;
          background: linear-gradient(90deg, rgba(0,255,140,0), rgba(0,255,140,0.65), rgba(0,255,140,0));
          margin: 14px 0;
        }

        .hintNeon {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: rgba(0,255,140,0.86);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .mutedNeon { color: rgba(0,255,140,0.55); }

        .rowTitle {
          text-align:center;
          margin-bottom: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .moveBtn {
          transition: all 0.2s ease;
        }
        .moveBtn.selected {
          box-shadow: 0 0 20px rgba(0, 255, 140, 0.5);
          transform: scale(1.05);
        }
      `}</style>

      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="h1">RPS</div>
        <div className="muted tiny mt-2">HOUSE RPS — 1% TO STAKERS</div>
        {status && <div className="muted tiny mt-2">{status}</div>}
        {wrongNetwork && (
          <div className="mt-2">
            <div className="danger tiny">SWITCH TO BASE SEPOLIA</div>
            <button 
              className="btn btnGold mt-2" 
              onClick={handleSwitchNetwork}
              disabled={isSwitchingNetwork}
            >
              {isSwitchingNetwork ? "SWITCHING..." : "SWITCH NETWORK"}
            </button>
          </div>
        )}
        <div className="muted tiny mt-1">RPS: {addresses.rps}</div>
      </div>

      {/* Icons */}
      <div className="rpsWrap px-4">
        <div className="panel rpsHandsWrap">
          <div className="rpsHandsRow">
            <div className="rpsSide" style={{ textAlign: "left" }}>
              <div className="muted tiny rpsLabel">PLAYER</div>
              <div className="tiny rpsAddress">{address ? shortAddr(address) : "—"}</div>
              <div style={{ marginTop: 10 }}>
                <MatrixRpsIcon
                  side="player"
                  move={playerMove}
                  isRevealing={isRevealing}
                  seed={playerSeed}
                  size={220}
                />
              </div>
              <div className="muted tiny mt-2">MOVE: {moveToLabel(playerMove)}</div>
            </div>

            <div className="rpsCenter">
              <div className="rpsCenterGlyph muted tiny" style={{ marginTop: 10 }}>
                {"<"}
                {"<"}
                {"<"}
                {"<"}
                {"<"}{" "}
                {isRevealing ? "REVEAL" : "VS"}{" "}
                {">"}
                {">"}
                {">"}
                {">"}
                {">"}
              </div>
              <div className="neonDivider" />
              <div className="hintNeon tiny">
                {isRevealing ? "SETTLING…" : pendingGameId ? "PENDING" : "READY"}
              </div>
              <div className="muted tiny mt-2">{pendingGameId ? `Game #${pendingGameId.toString()}` : "—"}</div>
            </div>

            <div className="rpsSide" style={{ textAlign: "right" }}>
              <div className="muted tiny rpsLabel">HOUSE</div>
              <div className="tiny rpsAddress">HOUSE</div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <MatrixRpsIcon
                  side="house"
                  move={houseMove}
                  isRevealing={isRevealing}
                  seed={houseSeed}
                  size={220}
                />
              </div>
              <div className="muted tiny mt-2">MOVE: {moveToLabel(houseMove)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="panel potCard cabinetPot" style={{ maxWidth: 620, margin: "18px auto 0" }}>
        <div className="h2">PLAY</div>

        {/* Step 1: Bet Amount */}
        <div className="mt-3 inset statBox">
          <div className="muted tiny">STEP 1: BET AMOUNT (BRRR)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              className="input"
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
              disabled={disableAll || !!pendingGameId}
              inputMode="decimal"
              placeholder="10"
              style={{ flex: 1 }}
            />
            <div className="muted tiny" style={{ whiteSpace: "nowrap" }}>
              min 10 / max 25,000
            </div>
          </div>
          {betWei > 0n && <div className="muted tiny mt-2">Parsed: {betPretty} BRRR</div>}
        </div>

        {/* Step 2: Approve (if needed) */}
        {needsApproval && (
          <div className="mt-4">
            <div className="rowTitle tiny">STEP 2: Approve BRRR</div>
            <button
              className="btn btnMint w-full"
              onClick={approve}
              disabled={!approveEnabled}
            >
              APPROVE BRRR
            </button>
            <div className="muted tiny mt-2" style={{ textAlign: "center" }}>
              Allowance: {formatUnits(allowance, BRRR_DECIMALS)} / Bet: {betPretty}
            </div>
          </div>
        )}

        {/* Step 3: Choose Move */}
        <div className="mt-4">
          <div className="rowTitle tiny">{needsApproval ? "STEP 3" : "STEP 2"}: Choose Your Move</div>
          <div className="flex gap-2">
            <button 
              className={`btn btnGold flex-1 moveBtn ${selectedMove === 0 ? 'selected' : ''}`} 
              onClick={() => selectMove(0)} 
              disabled={!moveSelectionEnabled}
            >
              🪨 ROCK
            </button>
            <button 
              className={`btn btnGold flex-1 moveBtn ${selectedMove === 1 ? 'selected' : ''}`} 
              onClick={() => selectMove(1)} 
              disabled={!moveSelectionEnabled}
            >
              📄 PAPER
            </button>
            <button 
              className={`btn btnGold flex-1 moveBtn ${selectedMove === 2 ? 'selected' : ''}`} 
              onClick={() => selectMove(2)} 
              disabled={!moveSelectionEnabled}
            >
              ✂️ SCISSORS
            </button>
          </div>
          {selectedMove !== null && (
            <div className="muted tiny mt-2" style={{ textAlign: "center" }}>
              Selected: {moveToLabel(selectedMove)}
            </div>
          )}
        </div>

        {/* Step 4: Play */}
        <div className="mt-4">
          <div className="rowTitle tiny">{needsApproval ? "STEP 4" : "STEP 3"}: Play!</div>
          <button
            className="btn btnBlue w-full"
            onClick={play}
            disabled={!playEnabled}
          >
            {isRevealing ? "SETTLING..." : "🎮 PLAY"}
          </button>
          <div className="muted tiny mt-2" style={{ textAlign: "center" }}>
            {selectedMove === null 
              ? "Select a move above to enable play."
              : needsApproval
              ? "Approve BRRR first."
              : "Click to play! Settlement is automatic via Chainlink."}
          </div>
        </div>

        {/* Outcome panel */}
        {resolved && (
          <div className="mt-4 inset statBox">
            <div className="muted tiny">OUTCOME</div>

            <div className="tiny mt-1">
              Player: {moveToLabel(resolved.playerMove)} vs House: {moveToLabel(resolved.houseMove)}
            </div>

            <div className="tiny mt-1" style={{ 
              color: resolved.outcome === 1 ? '#00ff8c' : resolved.outcome === 2 ? '#ff6b6b' : '#ffd700',
              fontWeight: 'bold'
            }}>
              {outcomeToLabel(resolved.outcome)}
            </div>

            <div className="muted tiny mt-3">ECONOMICS</div>
            <div className="tiny mt-1">Bet: {formatUnits(resolved.bet, BRRR_DECIMALS)} BRRR</div>
            <div className="tiny mt-1">Fee (to stakers): {formatUnits(resolved.fee, BRRR_DECIMALS)} BRRR</div>
            <div className="tiny mt-1">Payout to player: {formatUnits(resolved.payoutToPlayer, BRRR_DECIMALS)} BRRR</div>
            {houseNet !== null && (
              <div className="tiny mt-1">House net: {formatUnits(houseNet, BRRR_DECIMALS)} BRRR</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
