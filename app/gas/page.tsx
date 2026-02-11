"use client";

import * as React from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import styles from "./gas.module.css";

const BASE_SEPOLIA_CHAIN_ID = 84532;

const MARKET_ADDRESS =
  (process.env.NEXT_PUBLIC_GAS_PREDICTION_MARKET as `0x${string}` | undefined) ??
  ("0x0461c751ccf343E91B33681467f84eBB4201579A" as const);

const USDC_ADDRESS_ENV =
  (process.env.NEXT_PUBLIC_USDC as `0x${string}` | undefined) ??
  ("0x4971192F0a5D300a1aC16a39630C865737024458" as const);

const L1_SEPOLIA_RPC_URL =
  (process.env.NEXT_PUBLIC_L1_SEPOLIA_RPC_URL as string | undefined) ??
  (process.env.NEXT_PUBLIC_L1_RPC_URL as string | undefined) ??
  "https://ethereum-sepolia.publicnode.com";

const EXPECTED_L1_BLOCK_MS = 12_000;
const USDC_DECIMALS = 6;
const MAX_UINT256 = (2n ** 256n) - 1n;
const BET_BLOCKS = 20;

// ----------------------------
// ABIs (Phase-Based Contract)
// ----------------------------
const marketAbi = [
  // Phase and Active Game
  { type: "function", name: "currentPhase", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "activeGameId", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  {
    type: "function",
    name: "activeGame",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "gameId", type: "uint64" },
      { name: "phase", type: "uint8" },
      { name: "betStartL1", type: "uint64" },
      { name: "betEndL1", type: "uint64" },
      { name: "strikeWei", type: "uint64" },
      { name: "currentBasefeeWei", type: "uint64" },
      { name: "longPool", type: "uint128" },
      { name: "shortPool", type: "uint128" },
      { name: "blocksLeft", type: "uint64" },
    ],
  },
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
  { type: "function", name: "currentL1Number", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "currentBasefee", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  
  // User data
  { type: "function", name: "userLong", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "uint128" }] },
  { type: "function", name: "userShort", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "uint128" }] },
  { type: "function", name: "claimable", stateMutability: "view", inputs: [{ name: "gameId", type: "uint64" }, { name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  
  // Actions
  { type: "function", name: "betLong", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "betShort", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ name: "gameId", type: "uint64" }], outputs: [] },
  { type: "function", name: "settleGame", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

const erc20Abi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// ----------------------------
// Helpers
// ----------------------------
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function fmtGweiFromWei(wei?: bigint) {
  if (wei === undefined || wei === 0n) return "—";
  const s = formatUnits(wei, 9);
  const num = Number(s);
  if (!Number.isFinite(num)) return `${s} gwei`;
  return `${num.toFixed(num >= 100 ? 0 : num >= 10 ? 2 : 4)} gwei`;
}

function fmtUsdc(wei?: bigint) {
  if (wei === undefined) return "—";
  const v = Number(formatUnits(wei, USDC_DECIMALS));
  if (!Number.isFinite(v)) return `${formatUnits(wei, USDC_DECIMALS)} USDC`;
  return `${v.toFixed(2)} USDC`;
}

function fmtUsdcShort(wei?: bigint) {
  if (wei === undefined || wei === 0n) return "$0";
  const v = Number(formatUnits(wei, USDC_DECIMALS));
  return `$${v.toFixed(2)}`;
}

// Phase enum (matches contract)
const PhaseLabels: Record<number, string> = {
  0: "Idle",
  1: "Betting",
  2: "Waiting",
};

// Outcome enum
const OutcomeLabels: Record<number, string> = {
  0: "Unset",
  1: "Long Win 📈",
  2: "Short Win 📉",
  3: "Push 🤝",
  4: "Cancelled ❌",
};

// PNL Storage
type PnlData = { totalBetsIn: string; totalClaimsOut: string };

function loadPnl(addr: string): PnlData {
  try {
    const raw = localStorage.getItem(`gasPnl:${addr.toLowerCase()}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { totalBetsIn: "0", totalClaimsOut: "0" };
}

function savePnl(addr: string, data: PnlData) {
  try { localStorage.setItem(`gasPnl:${addr.toLowerCase()}`, JSON.stringify(data)); } catch {}
}

// Track game IDs for claimable scanning - PERSISTED
function loadGameIds(addr: string): bigint[] {
  try {
    const key = `gasGames:${addr.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      return ids.map(id => BigInt(id));
    }
  } catch {}
  return [];
}

function saveGameIds(addr: string, gameIds: bigint[]) {
  try {
    const key = `gasGames:${addr.toLowerCase()}`;
    const ids = gameIds.map(id => id.toString());
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
}

function addGameId(addr: string, gameId: bigint): bigint[] {
  const existing = loadGameIds(addr);
  if (!existing.some(id => id === gameId)) {
    const updated = [...existing, gameId].slice(-50); // Keep last 50
    saveGameIds(addr, updated);
    return updated;
  }
  return existing;
}

// L1 Client
const l1SepoliaClient = createPublicClient({ chain: sepolia, transport: http(L1_SEPOLIA_RPC_URL) });

export default function GasMarketPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [side, setSide] = React.useState<"long" | "short">("long");
  const [amount, setAmount] = React.useState<string>("");
  const [pnlData, setPnlData] = React.useState<PnlData>({ totalBetsIn: "0", totalClaimsOut: "0" });
  
  // Track recent games for claimable scanning - LOAD FROM STORAGE
  const [recentGameIds, setRecentGameIds] = React.useState<bigint[]>([]);
  
  // Load PnL and game IDs from storage on mount
  React.useEffect(() => {
    if (address) {
      setPnlData(loadPnl(address));
      setRecentGameIds(loadGameIds(address));
    } else {
      setPnlData({ totalBetsIn: "0", totalClaimsOut: "0" });
      setRecentGameIds([]);
    }
  }, [address]);

  const totalPnl = BigInt(pnlData.totalClaimsOut) - BigInt(pnlData.totalBetsIn);
  const pnlIsPositive = totalPnl >= 0n;

  // ---- Active Game Data ----
  const { data: activeGameData, refetch: refetchActiveGame } = useReadContract({
    abi: marketAbi, address: MARKET_ADDRESS, functionName: "activeGame",
    query: { refetchInterval: 3_000 },
  });

  const gameId = activeGameData?.[0] as bigint | undefined;
  const phase = activeGameData?.[1] as number | undefined;
  const betStartL1 = activeGameData?.[2] as bigint | undefined;
  const betEndL1 = activeGameData?.[3] as bigint | undefined;
  const strikeWei = activeGameData?.[4] as bigint | undefined;
  const currentBasefeeWei = activeGameData?.[5] as bigint | undefined;
  const longPoolTotal = activeGameData?.[6] as bigint | undefined ?? 0n;
  const shortPoolTotal = activeGameData?.[7] as bigint | undefined ?? 0n;
  const blocksLeft = activeGameData?.[8] as bigint | undefined;

  // Current L1 block
  const { data: currentL1Data } = useReadContract({
    abi: marketAbi, address: MARKET_ADDRESS, functionName: "currentL1Number",
    query: { refetchInterval: 3_000 },
  });
  const currentL1 = currentL1Data as bigint | undefined;

  // Track game IDs for claimable - also add current active game
  React.useEffect(() => {
    if (gameId && gameId > 0n && address) {
      setRecentGameIds(prev => {
        if (!prev.some(id => id === gameId)) {
          const updated = addGameId(address, gameId);
          return updated;
        }
        return prev;
      });
    }
  }, [gameId, address]);

  // ---- USDC ----
  const { data: marketUsdcAddr } = useReadContract({
    abi: marketAbi, address: MARKET_ADDRESS, functionName: "usdc",
    query: { refetchInterval: 60_000 },
  });
  const usdcAddress = (marketUsdcAddr as `0x${string}` | undefined) ?? USDC_ADDRESS_ENV;

  // ---- Balance & Allowance ----
  const { data: usdcBalanceWei, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi, address: usdcAddress, functionName: "balanceOf",
    args: address && usdcAddress ? [address] : undefined,
    query: { enabled: Boolean(address && usdcAddress), refetchInterval: 5_000 },
  });
  const usdcBalance = (usdcBalanceWei as bigint | undefined) ?? 0n;

  const { data: allowanceWei, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi, address: usdcAddress, functionName: "allowance",
    args: address && usdcAddress ? [address, MARKET_ADDRESS] : undefined,
    query: { enabled: Boolean(address && usdcAddress), refetchInterval: 5_000 },
  });
  const allowance = (allowanceWei as bigint | undefined) ?? 0n;

  // ---- User Bets for Active Game ----
  const { data: userLongBet, refetch: refetchUserLong } = useReadContract({
    abi: marketAbi, address: MARKET_ADDRESS, functionName: "userLong",
    args: gameId && gameId > 0n && address ? [gameId, address] : undefined,
    query: { enabled: Boolean(gameId && gameId > 0n && address), refetchInterval: 4_000 },
  });

  const { data: userShortBet, refetch: refetchUserShort } = useReadContract({
    abi: marketAbi, address: MARKET_ADDRESS, functionName: "userShort",
    args: gameId && gameId > 0n && address ? [gameId, address] : undefined,
    query: { enabled: Boolean(gameId && gameId > 0n && address), refetchInterval: 4_000 },
  });

  const userLongAmount = (userLongBet as bigint | undefined) ?? 0n;
  const userShortAmount = (userShortBet as bigint | undefined) ?? 0n;

  // Pool percentages
  const totalPool = longPoolTotal + shortPoolTotal;
  const longPct = totalPool > 0n ? Number((longPoolTotal * 100n) / totalPool) : 50;
  const shortPct = totalPool > 0n ? Number((shortPoolTotal * 100n) / totalPool) : 50;

  // ---- Claimable Scanning ----
  const [claimableGames, setClaimableGames] = React.useState<{ gameId: bigint; amount: bigint }[]>([]);
  const [claimableLoading, setClaimableLoading] = React.useState(false);

  React.useEffect(() => {
    if (!address || !publicClient || recentGameIds.length === 0) {
      setClaimableGames([]);
      return;
    }

    let cancelled = false;
    
    async function scanClaimable() {
      setClaimableLoading(true);
      const results: { gameId: bigint; amount: bigint }[] = [];
      
      for (const gId of recentGameIds) {
        if (cancelled) break;
        try {
          const claimable = await publicClient!.readContract({
            address: MARKET_ADDRESS, abi: marketAbi, functionName: "claimable",
            args: [gId, address!],
          }) as bigint;
          
          if (claimable > 0n) results.push({ gameId: gId, amount: claimable });
        } catch {}
      }
      
      if (!cancelled) {
        setClaimableGames(results);
        setClaimableLoading(false);
      }
    }
    
    // Scan immediately on mount and whenever recentGameIds changes
    scanClaimable();
    const interval = setInterval(scanClaimable, 8_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [address, publicClient, recentGameIds]);

  const totalClaimable = claimableGames.reduce((sum, g) => sum + g.amount, 0n);
  const firstClaimableGame = claimableGames.length > 0 ? claimableGames[0] : null;

  // ---- Progress Timer ----
  const [lastL1Seen, setLastL1Seen] = React.useState<bigint | undefined>(undefined);
  const [lastL1SeenAt, setLastL1SeenAt] = React.useState<number>(0);
  const [, forceTick] = React.useState(0);

  React.useEffect(() => {
    if (currentL1 === undefined) return;
    if (lastL1Seen === undefined || currentL1 !== lastL1Seen) {
      setLastL1Seen(currentL1);
      setLastL1SeenAt(Date.now());
    }
  }, [currentL1, lastL1Seen]);

  React.useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => x + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const progress = lastL1SeenAt === 0 ? 0 : clamp01((Date.now() - lastL1SeenAt) / EXPECTED_L1_BLOCK_MS);
  const secondsLeft = Math.max(0, (EXPECTED_L1_BLOCK_MS * (1 - progress)) / 1000);

  // Is in Waiting phase? (can manually settle as backup)
  const isWaiting = phase === 2;
  const isIdle = phase === 0;
  const isBetting = phase === 1;

  // ---- TX Handlers ----
  const amountWei = React.useMemo(() => {
    if (!amount) return 0n;
    try { return parseUnits(amount, USDC_DECIMALS); } catch { return 0n; }
  }, [amount]);

  const exceedsBalance = amountWei > usdcBalance;
  const needsApproval = amountWei > 0n && allowance < amountWei;

  function setPercent(p: number) {
    if (!usdcBalance || usdcBalance === 0n) return;
    setAmount(formatUnits((usdcBalance * BigInt(p)) / 100n, USDC_DECIMALS));
  }

  const [txBusy, setTxBusy] = React.useState(false);
  const [txError, setTxError] = React.useState<string | null>(null);
  const [txSuccess, setTxSuccess] = React.useState<string | null>(null);

  async function onApprove() {
    setTxError(null); setTxSuccess(null);
    if (!address || !usdcAddress || wrongChain || amountWei <= 0n) return;
    setTxBusy(true);
    try {
      await writeContractAsync({ abi: erc20Abi, address: usdcAddress, functionName: "approve", args: [MARKET_ADDRESS, MAX_UINT256] });
      setTxSuccess("Approved!");
      refetchAllowance();
    } catch (e: any) { setTxError(e?.shortMessage || e?.message || "Approve failed"); }
    finally { setTxBusy(false); }
  }

  async function onDeposit() {
    setTxError(null); setTxSuccess(null);
    console.log("[onDeposit] Starting...", { side, amountWei: amountWei.toString(), address, MARKET_ADDRESS, usdcAddress });
    
    if (wrongChain) { console.log("[onDeposit] Aborted: wrong chain"); return; }
    if (amountWei <= 0n) { console.log("[onDeposit] Aborted: amount is 0"); return; }
    if (exceedsBalance) { console.log("[onDeposit] Aborted: exceeds balance"); return; }
    if (!address) { console.log("[onDeposit] Aborted: no address"); return; }
    
    setTxBusy(true);
    try {
      console.log("[onDeposit] Calling writeContractAsync...", {
        functionName: side === "long" ? "betLong" : "betShort",
        args: [amountWei.toString()],
        address: MARKET_ADDRESS,
      });
      
      const hash = await writeContractAsync({ 
        abi: marketAbi, 
        address: MARKET_ADDRESS, 
        functionName: side === "long" ? "betLong" : "betShort", 
        args: [amountWei] 
      });
      
      console.log("[onDeposit] TX submitted!", hash);
      
      const newPnl = { ...pnlData, totalBetsIn: (BigInt(pnlData.totalBetsIn) + amountWei).toString() };
      setPnlData(newPnl);
      savePnl(address, newPnl);
      setAmount("");
      setTxSuccess(`Bet ${side.toUpperCase()} placed! TX: ${hash?.slice(0, 10)}...`);
      refetchBalance();
      
      // Refetch and save game ID for history
      const result = await refetchActiveGame();
      const newGameId = result.data?.[0] as bigint | undefined;
      if (newGameId && newGameId > 0n) {
        const updated = addGameId(address, newGameId);
        setRecentGameIds(updated);
      }
      
      refetchUserLong();
      refetchUserShort();
    } catch (e: any) { 
      console.error("[onDeposit] Error:", e);
      setTxError(e?.shortMessage || e?.message || "Bet failed"); 
    }
    finally { setTxBusy(false); }
  }

  async function onClaim() {
    setTxError(null); setTxSuccess(null);
    if (wrongChain || !address || !firstClaimableGame) return;
    setTxBusy(true);
    try {
      await writeContractAsync({ abi: marketAbi, address: MARKET_ADDRESS, functionName: "claim", args: [firstClaimableGame.gameId] });
      const newPnl = { ...pnlData, totalClaimsOut: (BigInt(pnlData.totalClaimsOut) + firstClaimableGame.amount).toString() };
      setPnlData(newPnl);
      savePnl(address, newPnl);
      setClaimableGames(prev => prev.filter(g => g.gameId !== firstClaimableGame.gameId));
      setTxSuccess(`Claimed ${fmtUsdc(firstClaimableGame.amount)}!`);
      refetchBalance();
    } catch (e: any) { setTxError(e?.shortMessage || e?.message || "Claim failed"); }
    finally { setTxBusy(false); }
  }

  // ---- UI ----
  const strikeGwei = fmtGweiFromWei(strikeWei);
  const currentGwei = fmtGweiFromWei(currentBasefeeWei);

  const pnlDisplay = React.useMemo(() => {
    if (!address) return "—";
    const absVal = totalPnl < 0n ? -totalPnl : totalPnl;
    return `${totalPnl >= 0n ? "+" : "-"}${fmtUsdcShort(absVal)}`;
  }, [address, totalPnl]);

  const panelGlassStyle: React.CSSProperties = { backgroundColor: "rgba(0,0,0,0.06)", borderColor: "rgba(0,255,140,0.14)" };

  const longBtnStyle: React.CSSProperties = side === "long"
    ? { backgroundColor: "rgba(0,255,140,0.18)", borderColor: "rgba(0,255,140,0.30)" }
    : { backgroundColor: "rgba(0,0,0,0.10)" };

  const shortBtnStyle: React.CSSProperties = side === "short"
    ? { backgroundColor: "rgba(255,70,70,0.22)", borderColor: "rgba(255,70,70,0.40)" }
    : { backgroundColor: "rgba(255,70,70,0.10)", borderColor: "rgba(255,70,70,0.22)" };

  // Phase badge
  const phaseBadge = isIdle ? "IDLE - Bet to Start" : isBetting ? "BETTING OPEN" : "WAITING FOR SETTLEMENT";
  const phaseColor = isIdle ? "rgba(255,200,100,0.9)" : isBetting ? "rgba(100,255,150,0.9)" : "rgba(255,150,100,0.9)";

  return (
    <div className={styles.page} style={{ background: "rgba(0,0,0,0.02)" }}>
      <div className={styles.headerRow}>
        <div className={styles.timer}>
          <span className={styles.timerLabel}>Timer →</span>
          <span className={styles.timerValue}>{secondsLeft.toFixed(2)}s</span>
        </div>
        {wrongChain ? (
          <div className={styles.warn}>Wrong network. Switch to <b>Base Sepolia</b>.</div>
        ) : (
          <div className={styles.subtle}>
            <span style={{ color: phaseColor, fontWeight: 700 }}>{phaseBadge}</span>
            {gameId && gameId > 0n && ` · Game #${gameId.toString()}`}
            {blocksLeft !== undefined && blocksLeft > 0n && ` · ${blocksLeft.toString()} blocks left`}
            {` · L1: ${currentL1?.toString() ?? "—"}`}
          </div>
        )}
      </div>

      <div className={styles.mainGrid}>
        {/* LEFT - Block Visualization */}
        <div className={styles.leftPanel} style={panelGlassStyle}>
          <div className={styles.leftTitle}>20 blocks betting window</div>

          {/* Current Game */}
          {gameId && gameId > 0n ? (
            <SegmentRow
              label={isBetting ? "Betting" : "Waiting"}
              avgText={isBetting ? `${blocksLeft?.toString() ?? "—"} blocks left` : "Chainlink settling..."}
              blocks={Array.from({ length: 20 }, (_, i) => (betStartL1 ?? 0n) + BigInt(i))}
              l1Now={currentL1}
              l1Progress={progress}
              tone={isBetting ? "active" : "done"}
            />
          ) : (
            <SegmentRow
              label="No Active Game"
              avgText="Place a bet to start!"
              blocks={Array.from({ length: 20 }, (_, i) => BigInt(i))}
              l1Now={undefined}
              l1Progress={0}
              tone="upcoming"
            />
          )}

          {/* Big Cube - Current Basefee */}
          <div className={styles.bigCubeSection} style={{ pointerEvents: "none", marginTop: 24 }}>
            <div className={styles.bigCubeTitle}>Current L1 Basefee</div>
            <div className={styles.bigCubeWrap}>
              <BigSolidCube 
                badge={isIdle ? "IDLE" : isBetting ? "BETTING" : "WAITING"} 
                l1Label={currentL1 ? `L1 #${currentL1.toString()}` : "—"}
                currentGwei={currentGwei} 
                strikeGwei={strikeGwei}
                status={currentBasefeeWei && strikeWei && strikeWei > 0n
                  ? currentBasefeeWei > strikeWei ? "📈 Above Strike" : currentBasefeeWei < strikeWei ? "📉 Below Strike" : "= At Strike"
                  : "—"
                }
              />
            </div>
          </div>

          <div className={styles.leftSpacer} />
        </div>

        {/* RIGHT - Betting Panel */}
        <div className={styles.rightPanel} style={{ ...panelGlassStyle, position: "relative" }}>
          <div className={styles.tabs} style={{ position: "relative", zIndex: 50 }}>
            <button className={`${styles.tabBtn} ${side === "long" ? styles.tabBtnActive : ""}`} onClick={() => setSide("long")} style={longBtnStyle}>Long 📈</button>
            <button className={`${styles.tabBtn} ${side === "short" ? styles.tabBtnActive : ""}`} onClick={() => setSide("short")} style={shortBtnStyle}>Short 📉</button>
          </div>

          {/* User Stats */}
          <div className={styles.betBox} style={{ backgroundColor: "rgba(0,0,0,0.14)", marginTop: 12 }}>
            <div className={styles.betRow}>
              <div className={styles.betLabel}>Your Bet</div>
              <div className={styles.betUnit}>
                {userLongAmount > 0n && <span style={{ color: "rgba(92,255,128,0.95)" }}>{fmtUsdcShort(userLongAmount)} LONG</span>}
                {userLongAmount > 0n && userShortAmount > 0n && <span style={{ opacity: 0.5 }}> / </span>}
                {userShortAmount > 0n && <span style={{ color: "rgba(255,120,120,0.95)" }}>{fmtUsdcShort(userShortAmount)} SHORT</span>}
                {userLongAmount === 0n && userShortAmount === 0n && "—"}
              </div>
            </div>

            <div className={styles.betRow}>
              <div className={styles.betLabel}>Rewards {claimableGames.length > 0 ? `(${claimableGames.length})` : ""}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <div className={styles.betUnit}>{address ? (claimableLoading ? "..." : fmtUsdc(totalClaimable)) : "—"}</div>
                <button className={styles.tabBtn} onClick={onClaim} disabled={wrongChain || txBusy || !address || totalClaimable <= 0n}
                  style={{ padding: "8px 10px", borderRadius: 12, opacity: totalClaimable <= 0n ? 0.55 : 1 }}>
                  Claim
                </button>
              </div>
            </div>

            <div className={styles.betRow} style={{ marginTop: 8 }}>
              <div className={styles.betLabel}>Pool</div>
              <div className={styles.betUnit}>
                <span style={{ color: "rgba(92,255,128,0.95)" }}>{longPct}% L</span>
                {" · "}
                <span style={{ color: "rgba(255,120,120,0.95)" }}>{shortPct}% S</span>
                <span style={{ opacity: 0.5, marginLeft: 8 }}>({fmtUsdc(totalPool)})</span>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div style={{ width: `${longPct}%`, backgroundColor: "rgba(92,255,128,0.7)", transition: "width 0.3s" }} />
                <div style={{ width: `${shortPct}%`, backgroundColor: "rgba(255,120,120,0.7)", transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          {/* Bet box */}
          <div className={styles.betBox} style={{ backgroundColor: "rgba(0,0,0,0.14)" }}>
            <div className={styles.betRow}>
              <div className={styles.betLabel}>Bet Amount</div>
              <div className={styles.betUnit}>USDC</div>
            </div>

            <input className={styles.betInput} value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" inputMode="decimal" disabled={wrongChain || isWaiting}
              style={{ backgroundColor: "rgba(0,0,0,0.18)", borderColor: exceedsBalance ? "rgba(255,90,90,0.8)" : undefined }} />

            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>Balance: {fmtUsdc(usdcBalance)}</div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[25, 50, 75, 100].map((p) => (
                <button key={p} className={styles.tabBtn} style={{ padding: "6px 10px", opacity: 0.8 }}
                  onClick={() => setPercent(p)} disabled={wrongChain || !address || usdcBalance === 0n || isWaiting}>{p}%</button>
              ))}
            </div>

            {needsApproval && (
              <button className={styles.betCta} disabled={wrongChain || txBusy || amountWei <= 0n}
                onClick={onApprove} style={{ marginTop: 10, marginBottom: 10, opacity: 1 }}>Approve USDC</button>
            )}

            <button className={styles.betCta} disabled={wrongChain || txBusy || amountWei <= 0n || needsApproval || exceedsBalance || isWaiting}
              onClick={onDeposit} style={{ marginTop: needsApproval ? 0 : 10, opacity: amountWei <= 0n || needsApproval || exceedsBalance || isWaiting ? 0.55 : 1 }}>
              {isIdle ? `Start Game & Bet ${side === "long" ? "Long" : "Short"}` : `Bet ${side === "long" ? "Long" : "Short"}`}
            </button>

            {isWaiting && <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,200,100,0.95)" }}>Betting closed - waiting for Chainlink settlement</div>}
            {exceedsBalance && <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,140,140,0.95)" }}>Exceeds balance</div>}
            {txError && <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,140,140,0.95)" }}>{txError}</div>}
            {txSuccess && <div style={{ marginTop: 10, fontSize: 12, color: "rgba(140,255,180,0.95)" }}>{txSuccess}</div>}
          </div>

          <div className={styles.descBox} style={{ backgroundColor: "rgba(0,0,0,0.14)" }}>
            <div className={styles.descTitle}>How it works</div>
            <div className={styles.descText}>
              {isIdle ? "No game active. Your bet starts a new game and sets the strike price!" : 
               isBetting ? `Betting open for ${blocksLeft?.toString() ?? "~20"} more blocks. Strike: ${strikeGwei}` :
               "Betting closed. Chainlink will settle the game automatically."}
            </div>
            <div className={styles.descMeta}>
              Long wins if settlement {">"} strike · Short wins if settlement {"<"} strike
            </div>
          </div>

          {/* Debug Panel */}
          <details style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            <summary style={{ cursor: "pointer", padding: "8px 0" }}>Debug Info</summary>
            <div style={{ padding: 12, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8, fontFamily: "monospace", lineHeight: 1.8 }}>
              <div>Market: {MARKET_ADDRESS}</div>
              <div>USDC: {usdcAddress}</div>
              <div>Phase: {phase ?? "undefined"} ({isIdle ? "Idle" : isBetting ? "Betting" : isWaiting ? "Waiting" : "?"})</div>
              <div>Game ID: {gameId?.toString() ?? "none"}</div>
              <div>L1 Block: {currentL1?.toString() ?? "undefined"}</div>
              <div>Bet Start L1: {betStartL1?.toString() ?? "undefined"}</div>
              <div>Bet End L1: {betEndL1?.toString() ?? "undefined"}</div>
              <div>Blocks Left: {blocksLeft?.toString() ?? "undefined"}</div>
              <div>Strike: {strikeWei?.toString() ?? "undefined"} wei</div>
              <div>Current Basefee: {currentBasefeeWei?.toString() ?? "undefined"} wei</div>
              <div>Long Pool: {longPoolTotal?.toString()} | Short Pool: {shortPoolTotal?.toString()}</div>
              <div>Your Balance: {usdcBalance?.toString()} | Allowance: {allowance?.toString()}</div>
              <div>Amount Wei: {amountWei.toString()} | Needs Approval: {needsApproval ? "yes" : "no"}</div>
              <div>Tracked Games: {recentGameIds.length} | Claimable Games: {claimableGames.length}</div>
            </div>
          </details>

        </div>
      </div>
    </div>
  );
}

// ----------------------------
// SegmentRow with 3D Cubes
// ----------------------------
function SegmentRow(props: { label: string; avgText: string | null; blocks: bigint[]; l1Now?: bigint; l1Progress: number; tone: "done" | "active" | "upcoming" }) {
  const { label, avgText, blocks, l1Now, l1Progress, tone } = props;

  const startBlock = blocks[0];
  const endBlock = blocks[blocks.length - 1];
  const rangeText = `${startBlock?.toString() ?? "—"} → ${endBlock?.toString() ?? "—"}`;

  return (
    <div className={styles.segmentWrap} style={{ alignItems: "center" }}>
      <div className={styles.segmentLabelCol} style={{ width: 120, marginRight: 10 }}>
        <div className={styles.segmentLabel}>{label}</div>
        {avgText && <div className={styles.segmentAvg}>{avgText}</div>}
      </div>

      <div className={styles.segmentRowBox} style={{ flex: 1, minWidth: 0, backgroundColor: "rgba(0,0,0,0.06)" }}>
        <div className={styles.rowMetaRight}>{rangeText}</div>
        <div className={styles.dragStrip}>
          <div className={styles.dragInner}>
            {[0, 1].map((row) => (
              <div key={row} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {blocks.slice(row * 10, row * 10 + 10).map((bn, i) => {
                  let fill = 0;
                  let state: "green" | "dark" | "grey" = "grey";

                  if (tone === "done") {
                    fill = 1; state = "dark";
                  } else if (tone === "upcoming") {
                    fill = 0; state = "grey";
                  } else if (l1Now !== undefined) {
                    if (l1Now > bn) { fill = 1; state = "dark"; }
                    else if (l1Now === bn) { fill = l1Progress; state = "green"; }
                    else { 
                      const dist = Number(bn - l1Now); 
                      fill = dist === 1 ? 0.18 * l1Progress : dist === 2 ? 0.07 * l1Progress : 0; 
                      state = "grey"; 
                    }
                  }

                  return (
                    <React.Fragment key={i}>
                      <div className={styles.blockCell}>
                        <SolidCube fill={fill} state={state} size={24} />
                      </div>
                      {i < 9 && <GlowConnector active={tone === "active" && l1Now !== undefined && l1Now >= bn} />}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------
// Glowing Connector
// ----------------------------
function GlowConnector({ active }: { active: boolean }) {
  return (
    <div style={{
      width: 16,
      height: 3,
      borderRadius: 2,
      background: active 
        ? "linear-gradient(90deg, rgba(0,255,140,0.8), rgba(0,255,140,0.4))"
        : "rgba(255,255,255,0.08)",
      boxShadow: active ? "0 0 8px rgba(0,255,140,0.6), 0 0 16px rgba(0,255,140,0.3)" : "none",
      transition: "all 0.3s ease",
    }} />
  );
}

// ----------------------------
// 3D Solid Cube (SVG)
// ----------------------------
function SolidCube(props: { fill: number; state: "green" | "dark" | "grey"; size: number }) {
  const { fill, state, size } = props;
  const w = size; const h = size; const d = Math.round(size * 0.35);

  const stroke = "rgba(0,255,140,0.22)";
  const topBase = state === "grey" ? "rgba(255,255,255,0.05)" : "rgba(0,255,140,0.10)";
  const sideBase = state === "grey" ? "rgba(255,255,255,0.04)" : "rgba(0,255,140,0.08)";
  const frontBase = state === "grey" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.18)";

  const fillAlpha = state === "dark" ? 0.75 : state === "green" ? 0.7 : 0.18;
  const fillColor = `rgba(0,255,140,${fillAlpha})`;
  const glowColor = state === "green" ? "rgba(0,255,140,0.5)" : state === "dark" ? "rgba(0,255,140,0.3)" : "none";

  const f = clamp01(fill);
  const svgW = w + d; const svgH = h + d;
  const fillY = d + (1 - f) * h; const fillH = f * h;
  const frontClipId = React.useId();

  return (
    <svg aria-hidden="true" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} 
      style={{ display: "block", filter: state !== "grey" ? `drop-shadow(0 0 4px ${glowColor})` : "none" }}>
      <defs>
        <clipPath id={frontClipId}><polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} /></clipPath>
      </defs>
      <polygon points={`${d},0 ${w + d},0 ${w},${d} 0,${d}`} fill={topBase} stroke={stroke} />
      <polygon points={`${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}`} fill={sideBase} stroke={stroke} />
      <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} fill={frontBase} stroke={stroke} />
      <g clipPath={`url(#${frontClipId})`}>
        <rect x={0} y={fillY} width={w} height={fillH} fill={fillColor} style={{ transition: "y 120ms linear, height 120ms linear" }} opacity={state === "grey" ? 0.55 : 0.95} />
      </g>
      <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} fill="none" stroke="rgba(0,0,0,0.25)" />
    </svg>
  );
}

// ----------------------------
// Big 3D Cube for Right Panel
// ----------------------------
function BigSolidCube(props: { badge: string; l1Label: string; currentGwei: string; strikeGwei: string; status: string }) {
  const w = 300; const h = 200; const d = 50;
  const svgW = w + d; const svgH = h + d;

  return (
    <div style={{ position: "relative", width: svgW, height: svgH }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block" }}>
        <polygon points={`${d},0 ${w + d},0 ${w},${d} 0,${d}`} fill="rgba(0,255,140,0.08)" stroke="rgba(0,255,140,0.18)" />
        <polygon points={`${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}`} fill="rgba(0,255,140,0.06)" stroke="rgba(0,255,140,0.18)" />
        <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} fill="rgba(0,0,0,0.18)" stroke="rgba(0,255,140,0.18)" />
      </svg>
      <div style={{ position: "absolute", left: 0, top: d, width: w, height: h, borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,255,140,0.10)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px 0" }}>
          <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(0,255,140,0.16)", background: "rgba(0,255,140,0.06)", fontSize: 11, letterSpacing: 1.5, color: "rgba(160,255,220,0.95)", fontWeight: 700 }}>{props.badge}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", paddingTop: 6 }}>{props.l1Label}</div>
        </div>
        <div style={{ padding: "12px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>CURRENT</div>
          <div style={{ marginTop: 6, fontSize: 38, fontWeight: 800, color: "rgba(170,255,225,0.98)" }}>
            {props.currentGwei.replace(" gwei", "")} <span style={{ fontSize: 18, opacity: 0.85 }}>gwei</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
            Strike: <b>{props.strikeGwei}</b> · {props.status}
          </div>
        </div>
      </div>
    </div>
  );
}
