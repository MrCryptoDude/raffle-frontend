"use client";

import * as React from "react";
import { useAccount, useConfig, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { erc20Abi, formatUnits, type Address, type Hash } from "viem";

import { LIVE_EVM_RPS_CHAINS, type RpsChain, type RpsChainKey } from "./rpsChains";
import {
  rpsPvpAbi,
  Status,
  loadSecret,
  forgetSecret,
  friendlyError,
  gameKey,
  sameAccount,
  type AnyGame,
  type OpenRow,
} from "./rpsPvp";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const CHAINS = LIVE_EVM_RPS_CHAINS;

/** A game as the EVM contract returns it. */
type RawGame = {
  creator: Address;
  createdAt: number;
  openUntil: number;
  status: number;
  result: number;
  challenger: Address;
  joinedAt: number;
  revealBy: number;
  creatorMove: number;
  challengerMove: number;
  stake: bigint;
  commitment: `0x${string}`;
};

function fromEvm(chain: RpsChain, id: bigint, g: RawGame): AnyGame {
  return {
    chain,
    id,
    creator: g.creator,
    challenger: /^0x0+$/.test(g.challenger) ? null : g.challenger,
    stake: g.stake,
    status: g.status,
    result: g.result,
    createdAt: Number(g.createdAt),
    openUntil: Number(g.openUntil),
    joinedAt: Number(g.joinedAt),
    revealBy: Number(g.revealBy),
    creatorMove: g.creatorMove,
    challengerMove: g.challengerMove,
    commitment: g.commitment,
  };
}

/**
 * Now, on each chain's own clock, ticking twice a second.
 *
 * The reveal window is thirty seconds, so a laptop clock a few seconds off
 * would show a countdown that lies. Each chain's latest block is sampled every
 * so often and the difference applied.
 */
export function useChainClock(): (key: RpsChainKey) => number {
  const config = useConfig();
  const [offsets, setOffsets] = React.useState<Partial<Record<RpsChainKey, number>>>({});
  const [tick, setTick] = React.useState(() => Date.now() / 1000);

  React.useEffect(() => {
    const id = setInterval(() => setTick(Date.now() / 1000), 500);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let stopped = false;
    const sync = async () => {
      for (const chain of CHAINS) {
        try {
          const client = getPublicClient(config, { chainId: chain.chainId as number });
          const block = await client?.getBlock();
          if (block && !stopped) {
            setOffsets((o) => ({ ...o, [chain.key]: Number(block.timestamp) - Date.now() / 1000 }));
          }
        } catch {}
      }
    };
    sync();
    const id = setInterval(sync, 15_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [config]);

  return React.useCallback((key: RpsChainKey) => tick + (offsets[key] ?? 0), [tick, offsets]);
}

export type ChainRules = {
  token?: Address;
  decimals?: number;
  symbol?: string;
  revealWindow?: number;
  joinWindow?: number;
  feeBps?: number;
};

export type RulesByChain = Partial<Record<RpsChainKey, ChainRules>>;

const RULE_FNS = ["token", "revealWindow", "joinWindow", "FEE_BPS"] as const;

/** Each chain's stake token and settings, which only change when the owner retunes them. */
export function useChainRules(): RulesByChain {
  const base = useReadContracts({
    contracts: CHAINS.flatMap((c) =>
      RULE_FNS.map((functionName) => ({
        chainId: c.chainId,
        address: c.game as Address,
        abi: rpsPvpAbi,
        functionName,
      }))
    ),
    query: { enabled: CHAINS.length > 0, staleTime: 60_000 },
  });

  const tokens = CHAINS.map((_, i) => base.data?.[i * RULE_FNS.length]?.result as Address | undefined);

  const meta = useReadContracts({
    contracts: CHAINS.flatMap((c, i) =>
      (["decimals", "symbol"] as const).map((functionName) => ({
        chainId: c.chainId,
        address: tokens[i] ?? ZERO,
        abi: erc20Abi,
        functionName,
      }))
    ),
    query: { enabled: tokens.some(Boolean), staleTime: Infinity },
  });

  return React.useMemo(() => {
    const out: RulesByChain = {};
    CHAINS.forEach((c, i) => {
      const at = (k: number) => base.data?.[i * RULE_FNS.length + k]?.result;
      out[c.key] = {
        token: at(0) as Address | undefined,
        revealWindow: at(1) as number | undefined,
        joinWindow: at(2) as number | undefined,
        feeBps: at(3) as number | undefined,
        decimals: at(0) ? (meta.data?.[i * 2]?.result as number | undefined) : undefined,
        symbol: at(0) ? (meta.data?.[i * 2 + 1]?.result as string | undefined) : undefined,
      };
    });
    return out;
  }, [base.data, meta.data]);
}

export type TableSeat = { chain: RpsChain; stake: bigint; waiting: number };

/** One dollar amount, with how busy it is on every chain that offers it. */
export type TableRow = { dollars: number; waiting: number; seats: TableSeat[] };

/**
 * Every table across every chain, merged by dollar amount.
 *
 * Tokens differ between chains, so the raw stake does too; the dollar value is
 * what a player compares. Each table remembers the raw stake on each chain for
 * when someone opens or joins there.
 */
export function useTables(rules: RulesByChain) {
  const q = useReadContracts({
    contracts: CHAINS.map((c) => ({
      chainId: c.chainId,
      address: c.game as Address,
      abi: rpsPvpAbi,
      functionName: "tierCounts" as const,
    })),
    query: { enabled: CHAINS.length > 0, refetchInterval: 3000 },
  });

  const tables = React.useMemo<TableRow[]>(() => {
    const byDollar = new Map<number, TableRow>();
    CHAINS.forEach((chain, i) => {
      const decimals = rules[chain.key]?.decimals;
      const res = q.data?.[i]?.result as readonly [readonly bigint[], readonly bigint[]] | undefined;
      if (!res || decimals === undefined) return;
      const [tiers, counts] = res;
      tiers.forEach((stake, j) => {
        const dollars = Number(formatUnits(stake, decimals));
        const row = byDollar.get(dollars) ?? { dollars, waiting: 0, seats: [] };
        const waiting = Number(counts[j] ?? 0n);
        row.seats.push({ chain, stake, waiting });
        row.waiting += waiting;
        byDollar.set(dollars, row);
      });
    });
    return [...byDollar.values()].sort((a, b) => a.dollars - b.dollars);
  }, [q.data, rules]);

  return { tables, loading: q.isLoading, refetch: q.refetch };
}

export type StakeWallet = { balance?: bigint; allowance?: bigint };

/** The connected wallet's stake-token balance and allowance on every chain. */
export function useStakeWallets(rules: RulesByChain) {
  const { address } = useAccount();

  const q = useReadContracts({
    contracts: CHAINS.flatMap((c) => {
      const token = rules[c.key]?.token ?? ZERO;
      return [
        {
          chainId: c.chainId,
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf" as const,
          args: [address ?? ZERO] as const,
        },
        {
          chainId: c.chainId,
          address: token,
          abi: erc20Abi,
          functionName: "allowance" as const,
          args: [address ?? ZERO, c.game as Address] as const,
        },
      ];
    }),
    query: {
      enabled: Boolean(address) && CHAINS.some((c) => rules[c.key]?.token),
      refetchInterval: 3000,
    },
  });

  const wallets = React.useMemo(() => {
    const out: Partial<Record<RpsChainKey, StakeWallet>> = {};
    CHAINS.forEach((c, i) => {
      if (!rules[c.key]?.token) return;
      out[c.key] = {
        balance: q.data?.[i * 2]?.result as bigint | undefined,
        allowance: q.data?.[i * 2 + 1]?.result as bigint | undefined,
      };
    });
    return out;
  }, [q.data, rules]);

  return { wallets, refetch: q.refetch };
}

type RawOpen = { id: bigint; creator: Address; stake: bigint; createdAt: bigint; openUntil: bigint };

/** Everyone waiting at one dollar amount, on every chain, oldest first. */
export function useLobby(table: TableRow | null) {
  const seats = React.useMemo(() => (table?.seats ?? []).filter((s) => s.chain.kind === "evm"), [table]);

  const q = useReadContracts({
    contracts: seats.map((s) => ({
      chainId: s.chain.chainId,
      address: s.chain.game as Address,
      abi: rpsPvpAbi,
      functionName: "lobby" as const,
      args: [s.stake] as const,
    })),
    query: { enabled: seats.length > 0, refetchInterval: 2000 },
  });

  const rows = React.useMemo<OpenRow[]>(() => {
    const out: OpenRow[] = [];
    seats.forEach((s, i) => {
      const res = q.data?.[i]?.result as readonly RawOpen[] | undefined;
      for (const r of res ?? []) {
        out.push({
          chain: s.chain,
          id: r.id,
          creator: r.creator,
          stake: r.stake,
          createdAt: Number(r.createdAt),
          openUntil: Number(r.openUntil),
        });
      }
    });
    return out.sort((a, b) => a.createdAt - b.createdAt);
  }, [q.data, seats]);

  return { rows, loading: q.isLoading, refetch: q.refetch };
}

/**
 * The connected player's latest games on every chain, newest first.
 *
 * Polls fast while anything is live, and keeps polling when the tab is in the
 * background - a creator waiting in another tab still has to notice the join
 * inside the reveal window.
 */
export function useMyGames(limit: number) {
  const { address } = useAccount();

  const q = useReadContracts({
    contracts: CHAINS.map((c) => ({
      chainId: c.chainId,
      address: c.game as Address,
      abi: rpsPvpAbi,
      functionName: "recentGamesOf" as const,
      args: [address ?? ZERO, BigInt(limit)] as const,
    })),
    query: {
      enabled: Boolean(address) && CHAINS.length > 0,
      refetchIntervalInBackground: true,
      refetchInterval: (query) => {
        const data = query.state.data as { result?: readonly [readonly bigint[], readonly RawGame[]] }[] | undefined;
        const live = data?.some((d) =>
          d.result?.[1]?.some((g) => g.status === Status.Open || g.status === Status.Joined)
        );
        return live ? 1000 : 4000;
      },
    },
  });

  const games = React.useMemo<AnyGame[]>(() => {
    const out: AnyGame[] = [];
    CHAINS.forEach((chain, i) => {
      const res = q.data?.[i]?.result as readonly [readonly bigint[], readonly RawGame[]] | undefined;
      if (!res) return;
      res[0].forEach((id, j) => out.push(fromEvm(chain, id, res[1][j])));
    });
    return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }, [q.data, limit]);

  return { games, loading: q.isLoading, refetch: q.refetch };
}

/**
 * Send a transaction on a given chain and wait for it to land.
 *
 * Switches the wallet to that chain first if it is elsewhere - a room on
 * Robinhood Chain has to be joined from Robinhood Chain. Throws a readable
 * message rather than a raw RPC error.
 */
export function useSend() {
  const config = useConfig();
  const { chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = React.useState<string | null>(null);

  const send = React.useCallback(
    async (key: string, chain: RpsChain, submit: () => Promise<Hash>) => {
      setBusy(key);
      try {
        if (chain.chainId === undefined) throw new Error(`${chain.name} is not an EVM chain.`);
        if (walletChainId !== chain.chainId) await switchChainAsync({ chainId: chain.chainId });
        const hash = await submit();
        const client = getPublicClient(config, { chainId: chain.chainId });
        if (!client) throw new Error(`No connection to ${chain.name}.`);
        const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 1000 });
        if (receipt.status !== "success") throw new Error("Transaction reverted.");
        return receipt;
      } catch (e) {
        throw new Error(friendlyError(e));
      } finally {
        setBusy(null);
      }
    },
    [config, walletChainId, switchChainAsync]
  );

  return { send, busy };
}

/**
 * Reveal the creator's move the moment someone joins, on whichever chain.
 *
 * The wallet still asks for a confirmation - and first to switch network, if
 * the game is on a chain the wallet is not on - which is the one step this
 * cannot take for the player. If that is declined or fails, the game stays in
 * `problems` so the interface can offer the button again while time remains.
 */
export function useAutoReveal(
  games: AnyGame[],
  nowFor: (key: RpsChainKey) => number,
  meFor: (chain: RpsChain) => string | undefined
) {
  const { writeContractAsync } = useWriteContract();
  const { send } = useSend();

  const attempted = React.useRef(new Set<string>());
  const [inFlight, setInFlight] = React.useState<Set<string>>(new Set());
  const [problems, setProblems] = React.useState<Record<string, string>>({});

  const revealNow = React.useCallback(
    async (g: AnyGame) => {
      if (g.chain.kind !== "evm") return;
      const key = gameKey(g);
      const secret = loadSecret(g.chain.key, g.chain.game, g.commitment);
      if (!secret) {
        setProblems((p) => ({ ...p, [key]: "This browser does not have the move for this game." }));
        return;
      }

      setInFlight((s) => new Set(s).add(key));
      setProblems(({ [key]: _, ...rest }) => rest);
      try {
        await send(`reveal:${key}`, g.chain, () =>
          writeContractAsync({
            chainId: g.chain.chainId as number,
            address: g.chain.game as Address,
            abi: rpsPvpAbi,
            functionName: "reveal",
            args: [g.id, secret.move, secret.salt],
          })
        );
        forgetSecret(g.chain.key, g.chain.game, g.commitment);
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
    for (const g of games) {
      // A finished game no longer needs its secret kept around.
      if (g.status === Status.Settled || g.status === Status.Cancelled) {
        forgetSecret(g.chain.key, g.chain.game, g.commitment);
        continue;
      }
      if (g.status !== Status.Joined || !sameAccount(g.creator, meFor(g.chain), g.chain)) continue;
      if (nowFor(g.chain.key) > g.revealBy) continue;

      const key = gameKey(g);
      if (attempted.current.has(key)) continue;
      attempted.current.add(key);
      void revealNow(g);
    }
  }, [games, nowFor, meFor, revealNow]);

  return { inFlight, problems, revealNow };
}
