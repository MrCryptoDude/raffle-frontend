"use client";

import * as React from "react";
import { useAccount, useReadContract, useReadContracts, usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi, type Address, type Hash } from "viem";

import { REQUIRED_CHAIN_ID } from "./addresses";
import { useNetworkCheck } from "../app/hooks/useNetworkCheck";
import {
  RPS_PVP_ADDRESS,
  rpsPvpAbi,
  Status,
  loadSecret,
  forgetSecret,
  friendlyError,
  type Game,
} from "./rpsPvp";

const GAME = RPS_PVP_ADDRESS as Address;
const DEPLOYED = RPS_PVP_ADDRESS !== "";
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Now, on the chain's clock, ticking twice a second.
 *
 * The reveal window is thirty seconds, so a laptop clock a few seconds off
 * would show a countdown that lies. The latest block's timestamp is sampled
 * every so often and the difference applied.
 */
export function useChainNow(): number {
  const publicClient = usePublicClient({ chainId: REQUIRED_CHAIN_ID });
  const [offset, setOffset] = React.useState(0);
  const [tick, setTick] = React.useState(() => Date.now() / 1000);

  React.useEffect(() => {
    const id = setInterval(() => setTick(Date.now() / 1000), 500);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!publicClient) return;
    let stopped = false;
    const sync = async () => {
      try {
        const block = await publicClient.getBlock();
        if (!stopped) setOffset(Number(block.timestamp) - Date.now() / 1000);
      } catch {}
    };
    sync();
    const id = setInterval(sync, 15_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [publicClient]);

  return tick + offset;
}

/** The stake token and the rules, which only change when the owner retunes them. */
export function useRpsConfig() {
  const base = useReadContracts({
    contracts: [
      { chainId: REQUIRED_CHAIN_ID, address: GAME, abi: rpsPvpAbi, functionName: "token" },
      { chainId: REQUIRED_CHAIN_ID, address: GAME, abi: rpsPvpAbi, functionName: "revealWindow" },
      { chainId: REQUIRED_CHAIN_ID, address: GAME, abi: rpsPvpAbi, functionName: "joinWindow" },
      { chainId: REQUIRED_CHAIN_ID, address: GAME, abi: rpsPvpAbi, functionName: "FEE_BPS" },
    ],
    query: { enabled: DEPLOYED, staleTime: 60_000 },
  });

  const token = base.data?.[0]?.result as Address | undefined;

  const meta = useReadContracts({
    contracts: [
      { chainId: REQUIRED_CHAIN_ID, address: token as Address, abi: erc20Abi, functionName: "decimals" },
      { chainId: REQUIRED_CHAIN_ID, address: token as Address, abi: erc20Abi, functionName: "symbol" },
    ],
    query: { enabled: Boolean(token), staleTime: Infinity },
  });

  const decimals = meta.data?.[0]?.result as number | undefined;

  return {
    deployed: DEPLOYED,
    token,
    decimals,
    symbol: meta.data?.[1]?.result as string | undefined,
    revealWindow: base.data?.[1]?.result as number | undefined,
    joinWindow: base.data?.[2]?.result as number | undefined,
    feeBps: base.data?.[3]?.result as number | undefined,
    ready: Boolean(token) && decimals !== undefined,
    error: base.error ?? meta.error,
  };
}

export type Table = { stake: bigint; waiting: number };

/** Every table and how many people are waiting at it, in one read. */
export function useTables() {
  const q = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    address: GAME,
    abi: rpsPvpAbi,
    functionName: "tierCounts",
    query: { enabled: DEPLOYED, refetchInterval: 3000 },
  });

  const tables = React.useMemo<Table[]>(() => {
    if (!q.data) return [];
    const [tiers, counts] = q.data;
    return tiers.map((stake, i) => ({ stake, waiting: Number(counts[i] ?? 0n) }));
  }, [q.data]);

  return { tables, loading: q.isLoading, refetch: q.refetch };
}

export type OpenGameRow = { id: bigint; creator: Address; stake: bigint; createdAt: bigint; openUntil: bigint };

/** The games that can be joined at one table right now. */
export function useLobby(stake: bigint | null) {
  const q = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    address: GAME,
    abi: rpsPvpAbi,
    functionName: "lobby",
    args: [stake ?? 0n],
    query: { enabled: DEPLOYED && stake !== null, refetchInterval: 2000 },
  });

  return { rows: (q.data ?? []) as readonly OpenGameRow[], loading: q.isLoading, refetch: q.refetch };
}

export type MyGame = { id: bigint; game: Game };

/**
 * The connected player's latest games.
 *
 * Polls fast while anything is live, and keeps polling when the tab is in the
 * background - a creator waiting in another tab still has to notice the join
 * inside the reveal window.
 */
export function useMyGames(limit: number) {
  const { address } = useAccount();

  const q = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    address: GAME,
    abi: rpsPvpAbi,
    functionName: "recentGamesOf",
    args: [address ?? ZERO, BigInt(limit)],
    query: {
      enabled: DEPLOYED && Boolean(address),
      refetchIntervalInBackground: true,
      refetchInterval: (query) => {
        const data = query.state.data as readonly [readonly bigint[], readonly Game[]] | undefined;
        const live = data?.[1]?.some((g) => g.status === Status.Open || g.status === Status.Joined);
        return live ? 1000 : 4000;
      },
    },
  });

  const games = React.useMemo<MyGame[]>(() => {
    if (!q.data) return [];
    const [ids, list] = q.data;
    return ids.map((id, i) => ({ id, game: list[i] as unknown as Game }));
  }, [q.data]);

  return { games, loading: q.isLoading, refetch: q.refetch };
}

/**
 * Send a transaction and wait for it to land, tracking which action is busy.
 * Throws a readable message rather than a raw RPC error.
 */
export function useSend() {
  const publicClient = usePublicClient({ chainId: REQUIRED_CHAIN_ID });
  const { ensureCorrectNetwork } = useNetworkCheck();
  const [busy, setBusy] = React.useState<string | null>(null);

  const send = React.useCallback(
    async (key: string, submit: () => Promise<Hash>) => {
      setBusy(key);
      try {
        if (!(await ensureCorrectNetwork())) throw new Error("Switch network to continue.");
        const hash = await submit();
        if (!publicClient) throw new Error("No connection to the chain.");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted.");
        return receipt;
      } catch (e) {
        throw new Error(friendlyError(e));
      } finally {
        setBusy(null);
      }
    },
    [publicClient, ensureCorrectNetwork]
  );

  return { send, busy };
}

/**
 * Reveal the creator's move the moment someone joins.
 *
 * The wallet still asks for a confirmation, which is the one step this cannot
 * take for the player. If that is declined or fails, the game stays in
 * `problems` so the interface can offer the button again while time remains.
 */
export function useAutoReveal(games: MyGame[], now: number) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { send } = useSend();

  const attempted = React.useRef(new Set<string>());
  const [inFlight, setInFlight] = React.useState<Set<string>>(new Set());
  const [problems, setProblems] = React.useState<Record<string, string>>({});

  const revealNow = React.useCallback(
    async (id: bigint, g: Game) => {
      const key = id.toString();
      const secret = loadSecret(REQUIRED_CHAIN_ID, GAME, g.commitment);
      if (!secret) {
        setProblems((p) => ({ ...p, [key]: "This browser does not have the move for this game." }));
        return;
      }

      setInFlight((s) => new Set(s).add(key));
      setProblems(({ [key]: _, ...rest }) => rest);
      try {
        await send(`reveal:${key}`, () =>
          writeContractAsync({
            chainId: REQUIRED_CHAIN_ID,
            address: GAME,
            abi: rpsPvpAbi,
            functionName: "reveal",
            args: [id, secret.move, secret.salt],
          })
        );
        forgetSecret(REQUIRED_CHAIN_ID, GAME, g.commitment);
      } catch (e) {
        setProblems((p) => ({ ...p, [key]: (e as Error).message }));
      } finally {
        setInFlight((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [send, writeContractAsync]
  );

  React.useEffect(() => {
    if (!address) return;
    const me = address.toLowerCase();
    for (const { id, game: g } of games) {
      // A finished game no longer needs its secret kept around.
      if (g.status === Status.Settled || g.status === Status.Cancelled) {
        forgetSecret(REQUIRED_CHAIN_ID, GAME, g.commitment);
        continue;
      }
      if (g.status !== Status.Joined || g.creator.toLowerCase() !== me) continue;
      if (now > g.revealBy) continue;

      const key = id.toString();
      if (attempted.current.has(key)) continue;
      attempted.current.add(key);
      void revealNow(id, g);
    }
  }, [games, address, now, revealNow]);

  return { inFlight, problems, revealNow };
}
