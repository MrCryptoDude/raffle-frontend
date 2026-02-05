"use client";

import * as React from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import styles from "./gas.module.css";

const BASE_SEPOLIA_CHAIN_ID = 84532;

const MARKET_ADDRESS =
  (process.env.NEXT_PUBLIC_GAS_PREDICTION_MARKET as `0x${string}` | undefined) ??
  ("0xD938241f42E89aa2268378c05Aeedccb5904486c" as const);

const USDC_ADDRESS_ENV =
  (process.env.NEXT_PUBLIC_USDC as `0x${string}` | undefined) ??
  ("0x46b542E7f00812610cad55E1E30B966CFc66a73c" as const);

const RPC_PROXY_URL = "/api/rpc";

// Base L1Block predeploy (Base / Base Sepolia)
const L1BLOCK_ADDRESS = "0x4200000000000000000000000000000000000015" as const;

// L1 Sepolia RPC fallback
const L1_SEPOLIA_RPC_URL =
  (process.env.NEXT_PUBLIC_L1_SEPOLIA_RPC_URL as string | undefined) ??
  (process.env.NEXT_PUBLIC_L1_RPC_URL as string | undefined) ??
  "https://ethereum-sepolia.publicnode.com";

// Visual timing (approx L1 block time)
const EXPECTED_L1_BLOCK_MS = 12_000;

const USDC_DECIMALS = 6;
const MAX_UINT256 = (2n ** 256n) - 1n;

// ----------------------------
// ABIs
// ----------------------------
const marketAbi = [
  {
    type: "function",
    name: "currentRound",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint64" },
      { name: "phase", type: "uint8" },
      {
        name: "w",
        type: "tuple",
        components: [
          { name: "betStartL1", type: "uint64" },
          { name: "betEndL1", type: "uint64" },
          { name: "obsStartL1", type: "uint64" },
          { name: "obsEndL1", type: "uint64" },
        ],
      },
      { name: "strikeWei", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "observationState",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint64" }],
    outputs: [
      { name: "lastObservedL1", type: "uint64" },
      { name: "count", type: "uint8" },
      { name: "samplesWei", type: "uint64[20]" },
    ],
  },
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "betLong", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "betShort", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "strikeForRound", stateMutability: "view", inputs: [{ name: "roundId", type: "uint64" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "initialStrikeWei", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ name: "roundId", type: "uint64" }], outputs: [] },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const marketEventsAbi = [
  {
    type: "event",
    name: "BetLong",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "roundId", type: "uint64", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "net", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BetShort",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "roundId", type: "uint64", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "net", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "roundId", type: "uint64", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const l1BlockAbi = [
  { type: "function", name: "number", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "basefee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

// ----------------------------
// Types / helpers
// ----------------------------
type RoundWindow = {
  betStartL1: bigint;
  betEndL1: bigint;
  obsStartL1: bigint;
  obsEndL1: bigint;
};

type LiveSample = { l1: bigint; basefeeWei: bigint };
type AnyLog = { args?: any; blockNumber?: bigint; logIndex?: number };

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function fmtGweiFromWei(wei?: bigint) {
  if (wei === undefined) return "—";
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

function avgFromSamples(samplesWei?: readonly bigint[], count?: number | bigint) {
  if (!samplesWei) return undefined;
  const nRaw = count ?? 0;
  const n = typeof nRaw === "bigint" ? Number(nRaw) : nRaw;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const m = Math.min(20, n);
  let sum = 0n;
  for (let i = 0; i < m; i++) sum += samplesWei[i] ?? 0n;
  return sum / BigInt(m);
}

function inferCountFromSamples(samplesWei?: readonly bigint[]) {
  if (!samplesWei) return 0;
  let c = 0;
  for (let i = 0; i < Math.min(20, samplesWei.length); i++) {
    const v = samplesWei[i];
    if (v !== undefined && v !== 0n) c++;
    else break;
  }
  return c;
}

// ----------------------------
// Clients
// ----------------------------
const l1SepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(L1_SEPOLIA_RPC_URL),
});

// ✅ CORS-safe + Alchemy-safe (calls go through /api/rpc)
const scanClient = createPublicClient({
  chain: {
    id: BASE_SEPOLIA_CHAIN_ID,
    name: "Base Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_PROXY_URL] } },
  } as any,
  transport: http(RPC_PROXY_URL),
});

async function fetchL1BasefeeWei(blockNumber: bigint): Promise<bigint | undefined> {
  try {
    const b = await l1SepoliaClient.getBlock({ blockNumber, includeTransactions: false });
    const bf = (b as any)?.baseFeePerGas;
    return typeof bf === "bigint" && bf > 0n ? bf : undefined;
  } catch {
    return undefined;
  }
}

// ----------------------------
// getLogs (Alchemy free-tier: 10 blocks max)
// ----------------------------
const ALCHEMY_MAX_RANGE = 10n;

async function getLogsChunked(opts: {
  address: `0x${string}`;
  eventName: "BetLong" | "BetShort" | "Claimed";
  args?: any; // ✅ keep loose to avoid TS + viem generic issues
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<AnyLog[]> {
  const out: AnyLog[] = [];
  let from = opts.fromBlock;

  while (from <= opts.toBlock) {
    const to = from + (ALCHEMY_MAX_RANGE - 1n) > opts.toBlock ? opts.toBlock : from + (ALCHEMY_MAX_RANGE - 1n);

    // ✅ critical: call via any to avoid "args must be undefined" TS inference bug
    const part = (await (scanClient as any).getLogs({
      address: opts.address,
      abi: marketEventsAbi,
      eventName: opts.eventName,
      args: opts.args ?? undefined,
      fromBlock: from,
      toBlock: to,
    })) as AnyLog[];

    out.push(...part);
    from = to + 1n;
  }

  out.sort((a, b) => {
    const ab = a.blockNumber ?? 0n;
    const bb = b.blockNumber ?? 0n;
    if (ab !== bb) return ab < bb ? -1 : 1;
    const ai = a.logIndex ?? 0;
    const bi = b.logIndex ?? 0;
    return ai - bi;
  });

  return out;
}

// ----------------------------
// PNL cache (localStorage)
// ----------------------------
type PnlCache = {
  netByRound: Record<string, string>;
  outByRound: Record<string, string>;
  cursor: string; // next block to scan
  lastScannedBlock: string;

  // ✅ track "last played" from actual bet logs, not guesses
  lastBetRoundId?: string;
  lastBetBn?: string;
  lastBetLi?: number;
};

function loadCache(addr: string): PnlCache | null {
  try {
    const raw = localStorage.getItem(`gasPnlCache:${addr}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.netByRound || !parsed?.outByRound || !parsed?.cursor) return null;
    return parsed as PnlCache;
  } catch {
    return null;
  }
}

function saveCache(addr: string, cache: PnlCache) {
  try {
    localStorage.setItem(`gasPnlCache:${addr}`, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

function addBigintStr(map: Record<string, string>, key: string, add: bigint) {
  const prev = map[key] ? BigInt(map[key]) : 0n;
  map[key] = (prev + add).toString();
}

function isLater(bnA?: bigint, liA?: number, bnB?: bigint, liB?: number) {
  const aBn = bnA ?? 0n;
  const bBn = bnB ?? 0n;
  if (aBn !== bBn) return aBn > bBn;
  return (liA ?? 0) > (liB ?? 0);
}

// ----------------------------
// Scanner policy (gentle)
// ----------------------------
const SCAN_INTERVAL_MS = 10_000;
const SCAN_BATCH_BLOCKS = 60n; // 60 blocks => 6 chunks per event => 18 rpc calls per tick (ok with backoff)
const INITIAL_LOOKBACK = 60_000n; // ✅ much more likely to include your earlier bets

export default function GasMarketPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;

  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // ---- UI state ----
  const [side, setSide] = React.useState<"long" | "short">("long");
  const [amount, setAmount] = React.useState<string>("");

  // ---- Reads: current round ----
  const { data: roundData } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "currentRound",
    query: { refetchInterval: 4_000 },
  });

  const roundId = (roundData?.[0] as bigint | undefined) ?? undefined;
  const phaseRaw = (roundData?.[1] as bigint | undefined) ?? undefined;
  const phase = phaseRaw !== undefined ? Number(phaseRaw) : undefined;
  const w = (roundData?.[2] as unknown as RoundWindow | undefined) ?? undefined;
  const strikeWei = (roundData?.[3] as bigint | undefined) ?? undefined;

  const prevRoundId = roundId !== undefined && roundId > 0n ? roundId - 1n : undefined;

  const { data: strikeForRoundWeiRaw } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "strikeForRound",
    args: roundId !== undefined ? [roundId] : undefined,
    query: { enabled: roundId !== undefined, refetchInterval: 6_000 },
  });

  const { data: initialStrikeWeiRaw } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "initialStrikeWei",
    query: { refetchInterval: 60_000 },
  });

  const strikeForRoundWei = (strikeForRoundWeiRaw as bigint | undefined) ?? 0n;
  const initialStrikeWei = (initialStrikeWeiRaw as bigint | undefined) ?? 0n;

  // ---- USDC addr ----
  const { data: marketUsdcAddr } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "usdc",
    query: { refetchInterval: 30_000 },
  });

  const usdcAddress = (marketUsdcAddr as `0x${string}` | undefined) ?? USDC_ADDRESS_ENV;

  // ---- Balance ----
  const { data: usdcBalanceWei } = useReadContract({
    abi: erc20Abi,
    address: usdcAddress,
    functionName: "balanceOf",
    args: address && usdcAddress ? [address] : undefined,
    query: { enabled: Boolean(address && usdcAddress), refetchInterval: 6_000 },
  });
  const usdcBalance = (usdcBalanceWei as bigint | undefined) ?? 0n;

  // ---- Allowance ----
  const { data: allowanceWei } = useReadContract({
    abi: erc20Abi,
    address: usdcAddress,
    functionName: "allowance",
    args: address && usdcAddress ? [address, MARKET_ADDRESS] : undefined,
    query: { enabled: Boolean(address && usdcAddress), refetchInterval: 6_000 },
  });
  const allowance = (allowanceWei as bigint | undefined) ?? 0n;

  // ---- L1 info ----
  const { data: l1Number } = useReadContract({
    abi: l1BlockAbi,
    address: L1BLOCK_ADDRESS,
    functionName: "number",
    query: { refetchInterval: 2_000 },
  });

  const { data: l1BasefeeWei } = useReadContract({
    abi: l1BlockAbi,
    address: L1BLOCK_ADDRESS,
    functionName: "basefee",
    query: { refetchInterval: 2_000 },
  });

  // ---- Observation states ----
  const { data: obsCur } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "observationState",
    args: roundId !== undefined ? [roundId] : undefined,
    query: { enabled: roundId !== undefined, refetchInterval: 4_000 },
  });

  const { data: obsPrev } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "observationState",
    args: prevRoundId !== undefined ? [prevRoundId] : undefined,
    query: { enabled: prevRoundId !== undefined, refetchInterval: 6_000 },
  });

  const obsCurCountRaw = obsCur?.[1] as unknown as bigint | number | undefined;
  const obsCurCount = typeof obsCurCountRaw === "bigint" ? Number(obsCurCountRaw) : (obsCurCountRaw ?? 0);
  const obsCurSamples = (obsCur?.[2] as readonly bigint[] | undefined) ?? undefined;

  const obsPrevCountRaw = obsPrev?.[1] as unknown as bigint | number | undefined;
  const obsPrevCount = typeof obsPrevCountRaw === "bigint" ? Number(obsPrevCountRaw) : (obsPrevCountRaw ?? 0);
  const obsPrevSamples = (obsPrev?.[2] as readonly bigint[] | undefined) ?? undefined;

  const obsCurCountEff = React.useMemo(() => Math.max(obsCurCount, inferCountFromSamples(obsCurSamples)), [obsCurCount, obsCurSamples]);
  const obsPrevCountEff = React.useMemo(() => Math.max(obsPrevCount, inferCountFromSamples(obsPrevSamples)), [obsPrevCount, obsPrevSamples]);

  const avgCurrent20Wei = React.useMemo(() => avgFromSamples(obsCurSamples, obsCurCountEff), [obsCurSamples, obsCurCountEff]);
  const avgFinished20Wei = React.useMemo(() => avgFromSamples(obsPrevSamples, obsPrevCountEff), [obsPrevSamples, obsPrevCountEff]);

  // -----------------------------
  // Reliable AVG fallback (your previous logic)
  // -----------------------------
  const lastSegStart = prevRoundId !== undefined ? (w?.obsStartL1 ? w.obsStartL1 - 40n : undefined) : undefined;
  const currentSegStart = phase === 0 ? w?.betStartL1 : w?.obsStartL1;

  const [rpcFinishedSamples, setRpcFinishedSamples] = React.useState<LiveSample[]>([]);
  const [rpcCurrentSamples, setRpcCurrentSamples] = React.useState<LiveSample[]>([]);

  React.useEffect(() => setRpcFinishedSamples([]), [prevRoundId?.toString(), lastSegStart?.toString()]);
  React.useEffect(() => setRpcCurrentSamples([]), [roundId?.toString(), String(phase ?? "x"), currentSegStart?.toString()]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!lastSegStart) return;
      if (obsPrevCountEff >= 20 && avgFinished20Wei !== undefined) return;

      const segEnd = lastSegStart + 19n;
      const need: bigint[] = [];
      const existing = new Set(rpcFinishedSamples.map((s) => s.l1.toString()));
      for (let bn = lastSegStart; bn <= segEnd; bn++) if (!existing.has(bn.toString())) need.push(bn);
      if (need.length === 0) return;

      const fetched: LiveSample[] = [];
      for (const bn of need) {
        const bf = await fetchL1BasefeeWei(bn);
        if (bf !== undefined) fetched.push({ l1: bn, basefeeWei: bf });
      }
      if (cancelled || fetched.length === 0) return;

      setRpcFinishedSamples((prev) => {
        const map = new Map(prev.map((s) => [s.l1.toString(), s]));
        for (const s of fetched) map.set(s.l1.toString(), s);
        return Array.from(map.values()).sort((a, b) => (a.l1 < b.l1 ? -1 : 1)).slice(0, 20);
      });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [lastSegStart, obsPrevCountEff, avgFinished20Wei, rpcFinishedSamples]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!currentSegStart) return;
      if (l1Number === undefined) return;
      if (obsCurCountEff > 0 && avgCurrent20Wei !== undefined) return;

      const segEnd = currentSegStart + 19n;
      const last = l1Number < segEnd ? l1Number : segEnd;
      if (last < currentSegStart) return;

      const need: bigint[] = [];
      const existing = new Set(rpcCurrentSamples.map((s) => s.l1.toString()));
      for (let bn = currentSegStart; bn <= last; bn++) if (!existing.has(bn.toString())) need.push(bn);
      if (need.length === 0) return;

      const fetched: LiveSample[] = [];
      for (const bn of need) {
        const bf = await fetchL1BasefeeWei(bn);
        if (bf !== undefined) fetched.push({ l1: bn, basefeeWei: bf });
      }
      if (cancelled || fetched.length === 0) return;

      setRpcCurrentSamples((prev) => {
        const map = new Map(prev.map((s) => [s.l1.toString(), s]));
        for (const s of fetched) map.set(s.l1.toString(), s);
        return Array.from(map.values()).sort((a, b) => (a.l1 < b.l1 ? -1 : 1));
      });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [currentSegStart, l1Number, obsCurCountEff, avgCurrent20Wei, rpcCurrentSamples]);

  const rpcFinishedAvgWei = React.useMemo(() => {
    if (rpcFinishedSamples.length !== 20) return undefined;
    return rpcFinishedSamples.reduce((s, x) => s + x.basefeeWei, 0n) / 20n;
  }, [rpcFinishedSamples]);

  const rpcCurrentAvgWei = React.useMemo(() => {
    if (rpcCurrentSamples.length === 0) return undefined;
    return rpcCurrentSamples.reduce((s, x) => s + x.basefeeWei, 0n) / BigInt(rpcCurrentSamples.length);
  }, [rpcCurrentSamples]);

  const reliableFinishedAvgWei = obsPrevCountEff >= 20 && avgFinished20Wei !== undefined ? avgFinished20Wei : rpcFinishedAvgWei;
  const reliableCurrentAvgWei = obsCurCountEff > 0 && avgCurrent20Wei !== undefined ? avgCurrent20Wei : rpcCurrentAvgWei;
  const reliableCurrentSampleCount = Math.max(obsCurCountEff, rpcCurrentSamples.length);

  // ---- progress timer ----
  const [lastL1Seen, setLastL1Seen] = React.useState<bigint | undefined>(undefined);
  const [lastL1SeenAt, setLastL1SeenAt] = React.useState<number>(0);
  const [, forceTick] = React.useState(0);

  React.useEffect(() => {
    if (l1Number === undefined) return;
    if (lastL1Seen === undefined) {
      setLastL1Seen(l1Number);
      setLastL1SeenAt(Date.now());
      return;
    }
    if (l1Number !== lastL1Seen) {
      setLastL1Seen(l1Number);
      setLastL1SeenAt(Date.now());
    }
  }, [l1Number, lastL1Seen]);

  React.useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => x + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const progress = lastL1SeenAt === 0 ? 0 : clamp01((Date.now() - lastL1SeenAt) / EXPECTED_L1_BLOCK_MS);
  const secondsLeft = Math.max(0, (EXPECTED_L1_BLOCK_MS * (1 - progress)) / 1000);

  const phaseLabel = phase === 0 ? "Betting" : phase === 1 ? "Observing" : "—";

  // -----------------------------
  // Approve / bet
  // -----------------------------
  const amountWei = React.useMemo(() => {
    if (!amount) return 0n;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    try {
      return parseUnits(amount, USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const exceedsBalance = amountWei > usdcBalance;
  const needsApproval = amountWei > 0n && allowance < amountWei;

  function setPercent(p: number) {
    if (!usdcBalance || usdcBalance === 0n) return;
    const v = (usdcBalance * BigInt(p)) / 100n;
    setAmount(formatUnits(v, USDC_DECIMALS));
  }

  const [txBusy, setTxBusy] = React.useState(false);
  const [txError, setTxError] = React.useState<string | null>(null);

  async function onApprove() {
    setTxError(null);
    if (!address) return;
    if (!usdcAddress) return;
    if (wrongChain) return;
    if (amountWei <= 0n) return;

    setTxBusy(true);
    try {
      await writeContractAsync({
        abi: erc20Abi,
        address: usdcAddress,
        functionName: "approve",
        args: [MARKET_ADDRESS, MAX_UINT256],
      });
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || "Approve failed");
    } finally {
      setTxBusy(false);
    }
  }

  async function onDeposit() {
    setTxError(null);
    if (wrongChain) return;
    if (amountWei <= 0n) return;
    if (exceedsBalance) return;

    setTxBusy(true);
    try {
      await writeContractAsync({
        abi: marketAbi,
        address: MARKET_ADDRESS,
        functionName: side === "long" ? "betLong" : "betShort",
        args: [amountWei],
      });
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || "Bet failed");
    } finally {
      setTxBusy(false);
    }
  }

  // -----------------------------
  // L2 block info
  // -----------------------------
  const [l2TxCount, setL2TxCount] = React.useState<number | null>(null);
  const [l2EthUsedWei, setL2EthUsedWei] = React.useState<bigint | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!publicClient) return;
      try {
        const block = await publicClient.getBlock({ blockTag: "latest", includeTransactions: false });
        if (cancelled) return;
        const txCount = Array.isArray(block.transactions) ? block.transactions.length : 0;
        setL2TxCount(txCount);

        const gasUsed = (block.gasUsed ?? 0n) as bigint;
        const baseFee = (block.baseFeePerGas ?? 0n) as bigint;
        setL2EthUsedWei(gasUsed * baseFee);
      } catch {
        if (cancelled) return;
        setL2TxCount(null);
        setL2EthUsedWei(null);
      }
    }
    run();
    const id = window.setInterval(run, 6_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [publicClient]);

  // -----------------------------
  // ✅ Automatic PNL scanning (fixed)
  // -----------------------------
  const [totalPnlWei, setTotalPnlWei] = React.useState<bigint | null>(null);
  const [lastPlayedText, setLastPlayedText] = React.useState<string>("—");
  const [lastPlayedRoundId, setLastPlayedRoundId] = React.useState<bigint | null>(null);
  const [currentBetWei, setCurrentBetWei] = React.useState<bigint | null>(null);
  const [scanStatus, setScanStatus] = React.useState<string>("—");

  const scanInFlightRef = React.useRef(false);
  const backoffMsRef = React.useRef<number>(0);
  const nextAllowedAtRef = React.useRef<number>(0);

  const cacheRef = React.useRef<PnlCache | null>(null);
  const cursorRef = React.useRef<bigint | null>(null);

  function recomputeFromCache(cache: PnlCache, currentRoundId?: bigint) {
    let total = 0n;
    for (const k of Object.keys(cache.netByRound)) {
      const net = BigInt(cache.netByRound[k] ?? "0");
      const out = BigInt(cache.outByRound[k] ?? "0");
      total += out - net;
    }
    setTotalPnlWei(total);

    // Current bet: depending on contract logic, users may be in roundId or roundId+1.
    if (currentRoundId !== undefined) {
      const k0 = currentRoundId.toString();
      const k1 = (currentRoundId + 1n).toString();
      const v0 = cache.netByRound[k0] ? BigInt(cache.netByRound[k0]) : 0n;
      const v1 = cache.netByRound[k1] ? BigInt(cache.netByRound[k1]) : 0n;
      setCurrentBetWei(v0 > v1 ? v0 : v1);
    } else {
      setCurrentBetWei(null);
    }

    // Last played: use cached last bet round (real)
    if (cache.lastBetRoundId) {
      const rid = BigInt(cache.lastBetRoundId);
      setLastPlayedRoundId(rid);

      const net = cache.netByRound[rid.toString()] ? BigInt(cache.netByRound[rid.toString()]) : 0n;
      const out = cache.outByRound[rid.toString()] ? BigInt(cache.outByRound[rid.toString()]) : 0n;
      const pnl = out - net;

      const isPending = currentRoundId !== undefined ? rid >= currentRoundId : out === 0n;
      setLastPlayedText(isPending ? `pending (net ${fmtUsdc(net)})` : fmtUsdc(pnl));
    } else {
      setLastPlayedRoundId(null);
      setLastPlayedText("—");
    }
  }

  // load cache when address changes
  React.useEffect(() => {
    cacheRef.current = null;
    cursorRef.current = null;

    setTotalPnlWei(null);
    setLastPlayedText("—");
    setLastPlayedRoundId(null);
    setCurrentBetWei(null);
    setScanStatus(address ? "loading cache…" : "—");

    if (!address) return;
    const addr = address.toLowerCase();

    const c = loadCache(addr);
    if (c) {
      cacheRef.current = c;
      cursorRef.current = BigInt(c.cursor);
      setScanStatus("cache loaded");
      recomputeFromCache(c, roundId);
    } else {
      setScanStatus("no cache (fresh scan)");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // also recompute when roundId changes (so current bet line updates even without new scans)
  React.useEffect(() => {
    if (!address) return;
    const addr = address.toLowerCase();
    const c = cacheRef.current ?? loadCache(addr);
    if (!c) return;
    cacheRef.current = c;
    recomputeFromCache(c, roundId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  React.useEffect(() => {
    if (!address) return;

    let cancelled = false;

    async function scanTick() {
      if (cancelled) return;
      if (scanInFlightRef.current) return;

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        setScanStatus("paused (tab hidden)");
        return;
      }

      const now = Date.now();
      if (now < nextAllowedAtRef.current) {
        setScanStatus(`backoff ${Math.ceil((nextAllowedAtRef.current - now) / 1000)}s`);
        return;
      }

      scanInFlightRef.current = true;

      try {
        const addrLower = (address ?? "").toLowerCase();
        if (!addrLower) return;


        const latest = await scanClient.getBlockNumber();

        // init cursor
        if (cursorRef.current === null) {
          const start = latest > INITIAL_LOOKBACK ? latest - INITIAL_LOOKBACK : 0n;
          cursorRef.current = start;

          // init cache
          const existing = loadCache(addr);
          if (existing) {
            cacheRef.current = existing;
            cursorRef.current = BigInt(existing.cursor);
          } else {
            cacheRef.current = {
              netByRound: {},
              outByRound: {},
              cursor: cursorRef.current.toString(),
              lastScannedBlock: "0",
            };
          }
        }

        const from = cursorRef.current!;
        if (from > latest) {
          setScanStatus("caught up");
          return;
        }

        const to = from + (SCAN_BATCH_BLOCKS - 1n) > latest ? latest : from + (SCAN_BATCH_BLOCKS - 1n);

        setScanStatus(`scanning ${from.toString()} → ${to.toString()}…`);

        // fetch logs for this window
        const [betsLong, betsShort, claims] = await Promise.all([
          getLogsChunked({ address: MARKET_ADDRESS, eventName: "BetLong", args: { user: address }, fromBlock: from, toBlock: to }),
          getLogsChunked({ address: MARKET_ADDRESS, eventName: "BetShort", args: { user: address }, fromBlock: from, toBlock: to }),
          getLogsChunked({ address: MARKET_ADDRESS, eventName: "Claimed", args: { user: address }, fromBlock: from, toBlock: to }),
        ]);

        if (cancelled) return;

        const cache = cacheRef.current!;
        // incorporate bets (defensive)
        const updateLastBet = (log: AnyLog) => {
          const rid = log.args?.roundId as bigint | undefined;
          if (rid === undefined) return;
          const bn = log.blockNumber;
          const li = log.logIndex;

          const prevBn = cache.lastBetBn ? BigInt(cache.lastBetBn) : undefined;
          const prevLi = cache.lastBetLi;

          if (!cache.lastBetRoundId || isLater(bn, li, prevBn, prevLi)) {
            cache.lastBetRoundId = rid.toString();
            cache.lastBetBn = (bn ?? 0n).toString();
            cache.lastBetLi = li ?? 0;
          }
        };

        for (const l of betsLong) {
          const rid = l.args?.roundId as bigint | undefined;
          const net = l.args?.net as bigint | undefined;
          if (rid === undefined || net === undefined) continue;
          addBigintStr(cache.netByRound, rid.toString(), net);
          updateLastBet(l);
        }

        for (const l of betsShort) {
          const rid = l.args?.roundId as bigint | undefined;
          const net = l.args?.net as bigint | undefined;
          if (rid === undefined || net === undefined) continue;
          addBigintStr(cache.netByRound, rid.toString(), net);
          updateLastBet(l);
        }

        for (const l of claims) {
          const rid = l.args?.roundId as bigint | undefined;
          const payout = l.args?.payout as bigint | undefined;
          if (rid === undefined || payout === undefined) continue;
          addBigintStr(cache.outByRound, rid.toString(), payout);
        }

        // advance
        cursorRef.current = to + 1n;
        cache.cursor = cursorRef.current.toString();
        cache.lastScannedBlock = to.toString();

        cacheRef.current = cache;
        saveCache(addr, cache);

        // recompute UI
        recomputeFromCache(cache, roundId);

        // reset backoff
        backoffMsRef.current = 0;
        nextAllowedAtRef.current = 0;

        setScanStatus(`scanned ${from.toString()} → ${to.toString()}`);
      } catch (e: any) {
        const prev = backoffMsRef.current || 0;
        const next = prev === 0 ? 6_000 : Math.min(prev * 2, 120_000);
        backoffMsRef.current = next;
        nextAllowedAtRef.current = Date.now() + next;

        const msg = (e?.shortMessage || e?.message || "").toString();
        if (msg.includes("429")) setScanStatus("rate limited (429) – backing off");
        else if (msg.includes("503")) setScanStatus("rpc 503 – backing off");
        else setScanStatus("rpc error – backing off");
      } finally {
        scanInFlightRef.current = false;
      }
    }

    scanTick();
    const id = window.setInterval(scanTick, SCAN_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [address, roundId]);

  const totalPnlText = totalPnlWei === null ? "—" : fmtUsdc(totalPnlWei);
  const pnlIsNegative = (totalPnlWei ?? 0n) < 0n;
  const pnlColor = pnlIsNegative ? "rgba(255,120,120,0.95)" : "rgba(92,255,128,0.95)";
  const currentBetText = currentBetWei === null ? "—" : fmtUsdc(currentBetWei);

  // ---- Rewards ----
  const { data: claimableWei } = useReadContract({
    abi: marketAbi,
    address: MARKET_ADDRESS,
    functionName: "claimable",
    args: lastPlayedRoundId !== null && address ? [lastPlayedRoundId, address] : undefined,
    query: { enabled: Boolean(lastPlayedRoundId !== null && address), refetchInterval: 6_000 },
  });

  const claimable = (claimableWei as bigint | undefined) ?? 0n;
  const rewardsText = address ? fmtUsdc(claimable) : "—";

  async function onClaim() {
    setTxError(null);
    if (wrongChain) return;
    if (!address) return;
    if (lastPlayedRoundId === null) return;
    if (claimable <= 0n) return;

    setTxBusy(true);
    try {
      await writeContractAsync({
        abi: marketAbi,
        address: MARKET_ADDRESS,
        functionName: "claim",
        args: [lastPlayedRoundId],
      });
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setTxBusy(false);
    }
  }

  // ---- Strike displayed ----
  const strikeWeiEffective =
    strikeWei !== undefined && strikeWei > 0n
      ? strikeWei
      : strikeForRoundWei > 0n
      ? strikeForRoundWei
      : initialStrikeWei > 0n
      ? initialStrikeWei
      : 0n;

  const uiStrikeWei = reliableFinishedAvgWei !== undefined ? reliableFinishedAvgWei : strikeWeiEffective;
  const strikeGwei = uiStrikeWei > 0n ? fmtGweiFromWei(uiStrikeWei) : "—";

  const desc =
    phase === 0
      ? `Betting open: basefee (next 20 L1 blocks) vs last 20 blocks strike ${strikeGwei}`
      : `Observing: Sampling the next 20 L1 blocks median vs last 20 blocks strike ${strikeGwei}`;

  const pausedLabel = phase === 0 ? "Betting blocks" : "Observing blocks";
  const upcomingLabel = phase === 0 ? "Upcoming 20 blocks - Paused" : "Upcoming 20 blocks - Bet";

  const panelGlassStyle: React.CSSProperties = {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderColor: "rgba(0,255,140,0.14)",
  };

  const pageBgStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.02)",
    backgroundColor: "rgba(0,0,0,0.02)",
  };

  // -----------------------------
  // SHORT TAB RED STYLE
  // -----------------------------
  const longBtnStyle: React.CSSProperties =
    side === "long"
      ? { backgroundColor: "rgba(0,255,140,0.18)", borderColor: "rgba(0,255,140,0.30)" }
      : { backgroundColor: "rgba(0,0,0,0.10)" };

  const shortBtnStyle: React.CSSProperties =
    side === "short"
      ? { backgroundColor: "rgba(255,70,70,0.22)", borderColor: "rgba(255,70,70,0.40)" }
      : { backgroundColor: "rgba(255,70,70,0.10)", borderColor: "rgba(255,70,70,0.22)" };

  return (
    <div className={styles.page} style={pageBgStyle}>
      <div className={styles.headerRow}>
        <div className={styles.timer}>
          <span className={styles.timerLabel}>Timer →</span>{" "}
          <span className={styles.timerValue}>{secondsLeft.toFixed(2)} seconds left</span>
        </div>

        {wrongChain ? (
          <div className={styles.warn}>
            Wrong network. Switch to <b>Base Sepolia (84532)</b>.
          </div>
        ) : (
          <div className={styles.subtle}>
            Phase: <b>{phaseLabel}</b> · Round: <b>{roundId?.toString() ?? "—"}</b> · L1:{" "}
            <b>{l1Number?.toString() ?? "—"}</b>
          </div>
        )}
      </div>

      <div className={styles.mainGrid}>
        {/* LEFT */}
        <div className={styles.leftPanel} style={panelGlassStyle}>
          <div className={styles.leftTitle}>Displays 20 blocks per row</div>

          <SegmentRow
            label="Last 20 blocks"
            avgText={reliableFinishedAvgWei !== undefined ? `${fmtGweiFromWei(reliableFinishedAvgWei)} avg` : "avg —"}
            start={prevRoundId !== undefined ? (w?.obsStartL1 ? w.obsStartL1 - 40n : undefined) : undefined}
            end={prevRoundId !== undefined ? (w?.obsEndL1 ? w.obsEndL1 - 40n : undefined) : undefined}
            l1Now={l1Number}
            l1Progress={progress}
            tone="done"
          />

          <SegmentRow
            label={pausedLabel}
            avgText={reliableCurrentAvgWei !== undefined ? `${fmtGweiFromWei(reliableCurrentAvgWei)} avg` : "avg —"}
            start={phase === 0 ? w?.betStartL1 : w?.obsStartL1}
            end={phase === 0 ? w?.betEndL1 : w?.obsEndL1}
            l1Now={l1Number}
            l1Progress={progress}
            tone="active"
          />

          <SegmentRow
            label={upcomingLabel}
            avgText={null}
            start={w?.betStartL1 !== undefined ? w.betStartL1 + 40n : undefined}
            end={w?.betEndL1 !== undefined ? w.betEndL1 + 40n : undefined}
            l1Now={l1Number}
            l1Progress={progress}
            tone="upcoming"
          />

          <div className={styles.leftSpacer} />
        </div>

        {/* RIGHT */}
        <div className={styles.rightPanel} style={{ ...panelGlassStyle, position: "relative" }}>
          <div className={styles.tabs} style={{ position: "relative", zIndex: 50, pointerEvents: "auto" }}>
            <button
              className={`${styles.tabBtn} ${side === "long" ? styles.tabBtnActive : ""}`}
              onClick={() => setSide("long")}
              type="button"
              style={longBtnStyle}
            >
              Long
            </button>
            <button
              className={`${styles.tabBtn} ${side === "short" ? styles.tabBtnActive : ""}`}
              onClick={() => setSide("short")}
              type="button"
              style={shortBtnStyle}
            >
              Short
            </button>
          </div>

          {/* PNL + current bet + Rewards */}
          <div className={styles.betBox} style={{ backgroundColor: "rgba(0,0,0,0.14)", marginTop: 12 }}>
            <div className={styles.betRow}>
              <div className={styles.betLabel}>total PNL =</div>
              <div className={styles.betUnit}>{totalPnlText}</div>
            </div>

            <div className={styles.betRow}>
              <div className={styles.betLabel}>Last played game</div>
              <div className={styles.betUnit}>{lastPlayedText}</div>
            </div>

            <div className={styles.betRow}>
              <div className={styles.betLabel}>current bet</div>
              <div className={styles.betUnit} style={{ color: pnlColor }}>
                {currentBetText}
              </div>
            </div>

            <div className={styles.betRow}>
              <div className={styles.betLabel}>scan</div>
              <div className={styles.betUnit}>{address ? scanStatus : "—"}</div>
            </div>

            <div className={styles.betRow} style={{ marginBottom: 0 }}>
              <div className={styles.betLabel}>Rewards</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <div className={styles.betUnit}>{rewardsText}</div>
                <button
                  className={styles.tabBtn}
                  type="button"
                  onClick={onClaim}
                  disabled={wrongChain || txBusy || !address || lastPlayedRoundId === null || claimable <= 0n}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    opacity: wrongChain || txBusy || !address || lastPlayedRoundId === null || claimable <= 0n ? 0.55 : 1,
                  }}
                >
                  Claim
                </button>
              </div>
            </div>
          </div>

          {/* Bet box */}
          <div className={styles.betBox} style={{ backgroundColor: "rgba(0,0,0,0.14)" }}>
            <div className={styles.betRow}>
              <div className={styles.betLabel}>Pay (amount user wants to bet)</div>
              <div className={styles.betUnit}>USDC</div>
            </div>

            <input
              className={styles.betInput}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              disabled={wrongChain}
              style={{
                backgroundColor: "rgba(0,0,0,0.18)",
                borderColor: exceedsBalance ? "rgba(255,90,90,0.8)" : undefined,
                color: exceedsBalance ? "rgba(255,120,120,0.95)" : undefined,
              }}
            />

            <div
              style={{
                fontSize: 12,
                opacity: 0.55,
                marginTop: 6,
                color: exceedsBalance ? "rgba(255,120,120,0.95)" : undefined,
              }}
            >
              Balance: {fmtUsdc(usdcBalance)}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={styles.tabBtn}
                  style={{ padding: "6px 10px", opacity: 0.8 }}
                  onClick={() => setPercent(p)}
                  disabled={wrongChain || !address || usdcBalance === 0n}
                >
                  {p}%
                </button>
              ))}
            </div>

            {needsApproval ? (
              <button
                className={styles.betCta}
                disabled={wrongChain || txBusy || amountWei <= 0n || !usdcAddress}
                type="button"
                onClick={onApprove}
                style={{ marginBottom: 10, opacity: 1 }}
              >
                Approve USDC
              </button>
            ) : null}

            <button
              className={styles.betCta}
              disabled={wrongChain || txBusy || amountWei <= 0n || needsApproval || exceedsBalance}
              type="button"
              onClick={onDeposit}
              style={{ opacity: wrongChain || txBusy || amountWei <= 0n || needsApproval || exceedsBalance ? 0.55 : 1 }}
            >
              Deposit now ({side === "long" ? "Long" : "Short"})
            </button>

            {exceedsBalance ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,140,140,0.95)" }}>
                Amount exceeds your USDC balance.
              </div>
            ) : null}

            {txError ? <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,140,140,0.95)" }}>{txError}</div> : null}
          </div>

          <div className={styles.descBox} style={{ backgroundColor: "rgba(0,0,0,0.14)" }}>
            <div className={styles.descTitle}>Description</div>
            <div className={styles.descText}>{desc}</div>
            <div className={styles.descMeta}>
              Strike: <b>{strikeGwei}</b>
            </div>
          </div>

          <div className={styles.bigCubeSection} style={{ pointerEvents: "none" }}>
            <div className={styles.bigCubeTitle}>Price of current confirming block</div>

            <div className={styles.bigCubeWrap}>
              <BigSolidCube
                badge={phaseLabel.toUpperCase()}
                l1Label={l1Number ? `L1 #${l1Number.toString()}` : "L1 —"}
                currentGwei={fmtGweiFromWei(l1BasefeeWei)}
                avgGwei={reliableCurrentAvgWei !== undefined ? fmtGweiFromWei(reliableCurrentAvgWei) : "—"}
                samples={`${reliableCurrentSampleCount}/20`}
                txs={"—"}
                ethUsed={"—"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------
// Components (unchanged visuals)
// ----------------------------
function SegmentRow(props: {
  label: string;
  avgText: string | null;
  start?: bigint;
  end?: bigint;
  l1Now?: bigint;
  l1Progress: number;
  tone: "done" | "active" | "upcoming";
}) {
  const { label, avgText, start, end, l1Now, l1Progress, tone } = props;

  const blocks = React.useMemo(() => {
    if (start === undefined) return Array.from({ length: 20 }, (_, i) => BigInt(i));
    return Array.from({ length: 20 }, (_, i) => start + BigInt(i));
  }, [start]);

  const rangeText = start !== undefined && end !== undefined ? `${start.toString()} → ${end.toString()}` : "—";

  return (
    <div className={styles.segmentWrap} style={{ alignItems: "center" }}>
      <div className={styles.segmentLabelCol} style={{ width: 148, marginRight: 10 }}>
        <div className={styles.segmentLabel}>{label}</div>
        {avgText ? <div className={styles.segmentAvg}>{avgText}</div> : null}
      </div>

      <div className={styles.segmentRowBox} style={{ flex: 1, minWidth: 0, backgroundColor: "rgba(0,0,0,0.06)" }}>
        <div className={styles.rowMetaRight}>{rangeText}</div>

        <div className={styles.dragStrip}>
          <div className={styles.dragInner}>
            {[0, 1].map((row) => (
              <div
                key={row}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: row === 0 ? 30 : 50,
                }}
              >
                {blocks.slice(row * 10, row * 10 + 10).map((bn, i) => {
                  const idx = row * 10 + i;

                  let fill = 0;
                  let state: "green" | "dark" | "grey" = "grey";

                  if (l1Now === undefined || start === undefined) {
                    fill = 0;
                    state = "grey";
                  } else if (tone === "done") {
                    fill = 1;
                    state = "dark";
                  } else if (tone === "upcoming") {
                    fill = 0;
                    state = "grey";
                  } else {
                    const now = l1Now;

                    if (now > bn) {
                      fill = 1;
                      state = "dark";
                    } else if (now === bn) {
                      fill = l1Progress;
                      state = "green";
                    } else {
                      const dist = Number(bn - now);
                      const prefill = dist === 1 ? 0.18 * l1Progress : dist === 2 ? 0.07 * l1Progress : 0;
                      fill = prefill;
                      state = "grey";
                    }
                  }

                  return (
                    <div key={idx} className={styles.blockCell}>
                      <SolidCube fill={fill} state={state} size={28} />
                      {i < 9 ? <div className={styles.connector} /> : null}
                    </div>
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

function SolidCube(props: { fill: number; state: "green" | "dark" | "grey"; size: number }) {
  const { fill, state, size } = props;

  const w = size;
  const h = size;
  const d = Math.round(size * 0.35);

  const stroke = "rgba(0,255,140,0.22)";
  const topBase = state === "grey" ? "rgba(255,255,255,0.05)" : "rgba(0,255,140,0.10)";
  const sideBase = state === "grey" ? "rgba(255,255,255,0.04)" : "rgba(0,255,140,0.08)";
  const frontBase = state === "grey" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.18)";

  const fillAlpha = state === "dark" ? 0.75 : state === "green" ? 0.7 : 0.18;
  const fillColor = `rgba(0,255,140,${fillAlpha})`;

  const f = clamp01(fill);

  const svgW = w + d;
  const svgH = h + d;

  const fillY = d + (1 - f) * h;
  const fillH = f * h;

  const frontClipId = React.useId();

  return (
    <svg aria-hidden="true" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block" }}>
      <defs>
        <clipPath id={frontClipId}>
          <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} />
        </clipPath>
      </defs>

      <polygon points={`${d},0 ${w + d},0 ${w},${d} 0,${d}`} fill={topBase} stroke={stroke} />
      <polygon points={`${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}`} fill={sideBase} stroke={stroke} />
      <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} fill={frontBase} stroke={stroke} />

      <g clipPath={`url(#${frontClipId})`}>
        <rect
          x={0}
          y={fillY}
          width={w}
          height={fillH}
          fill={fillColor}
          style={{ transition: "y 120ms linear, height 120ms linear, opacity 120ms linear" } as any}
          opacity={state === "grey" ? 0.55 : 0.95}
        />
      </g>

      <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} fill="none" stroke="rgba(0,0,0,0.25)" />
    </svg>
  );
}

function BigSolidCube(props: {
  badge: string;
  l1Label: string;
  currentGwei: string;
  avgGwei: string;
  samples: string;
  txs: string;
  ethUsed: string;
}) {
  const w = 320;
  const h = 360;
  const d = 60;

  const svgW = w + d;
  const svgH = h + d;

  const stroke = "rgba(0,255,140,0.18)";
  const topColor = "rgba(0,255,140,0.08)";
  const sideColor = "rgba(0,255,140,0.06)";
  const frontColor = "rgba(0,0,0,0.18)";

  return (
    <div aria-hidden="true" style={{ position: "relative", width: svgW, height: svgH }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block" }}>
        <polygon points={`${d},0 ${w + d},0 ${w},${d} 0,${d}`} fill={topColor} stroke={stroke} />
        <polygon points={`${w},${d} ${w + d},0 ${w + d},${h} ${w},${h + d}`} fill={sideColor} stroke={stroke} />
        <polygon points={`0,${d} ${w},${d} ${w},${h + d} 0,${h + d}`} fill={frontColor} stroke={stroke} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: d,
          width: w,
          height: h,
          borderRadius: 14,
          overflow: "hidden",
          background: "rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,255,140,0.10)",
          backdropFilter: "blur(2px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px 0 16px" }}>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid rgba(0,255,140,0.16)`,
              background: "rgba(141, 14, 180, 0.06)",
              fontSize: 12,
              letterSpacing: 2,
              color: "rgba(160,255,220,0.95)",
              fontWeight: 700,
            }}
          >
            {props.badge}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", paddingTop: 6 }}>{props.l1Label}</div>
        </div>

        <div style={{ padding: "18px 18px 0 18px" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.60)", fontWeight: 700 }}>CURRENT</div>
          <div style={{ marginTop: 10, fontSize: 46, fontWeight: 800, color: "rgba(170,255,225,0.98)" }}>
            {props.currentGwei.replace(" gwei", "")} <span style={{ fontSize: 22, opacity: 0.9 }}>gwei</span>
          </div>

          <div style={{ marginTop: 16, fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.55)", fontWeight: 800 }}>
            AVG (THIS 20)
          </div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: "rgba(170,255,225,0.95)" }}>
            {props.avgGwei.replace(" gwei", "")} <span style={{ fontSize: 14, opacity: 0.85 }}>gwei</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
              · samples {props.samples}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
