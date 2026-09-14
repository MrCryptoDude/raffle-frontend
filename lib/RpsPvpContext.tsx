"use client";

import * as React from "react";
import { useAccount, useWriteContract } from "wagmi";
import { erc20Abi, maxUint256, type Address } from "viem";

import type { RpsChain, RpsChainKey } from "./rpsChains";
import {
  rpsPvpAbi,
  Status,
  commitmentFor,
  newSalt,
  saveSecret,
  gameKey,
  sameAccount,
  type AnyGame,
  type Move,
  type OpenRow,
} from "./rpsPvp";
import {
  useAutoReveal,
  useChainClock,
  useChainRules,
  useMyGames,
  useSend,
  type RulesByChain,
} from "./useRpsPvp";

type Value = {
  nowFor: (key: RpsChainKey) => number;
  /** The connected account on a chain, if any. */
  meFor: (chain: RpsChain) => string | undefined;
  anyConnected: boolean;
  rules: RulesByChain;
  games: AnyGame[];
  loading: boolean;
  refetch: () => void;
  /** Which action is waiting on the wallet or the chain, if any. */
  busy: string | null;
  inFlight: Set<string>;
  problems: Record<string, string>;
  revealNow: (g: AnyGame) => Promise<void>;
  openGame: (chain: RpsChain, stake: bigint, move: Move) => Promise<void>;
  joinGame: (row: OpenRow, move: Move) => Promise<void>;
  approve: (chain: RpsChain) => Promise<void>;
  cancelGame: (g: AnyGame) => Promise<void>;
  claimGame: (g: AnyGame) => Promise<void>;
};

const Ctx = React.createContext<Value | null>(null);

/**
 * Watches the connected player's games on every chain, from every page, and
 * holds every game action.
 *
 * Mounted once around the whole app because the reveal window is short: a
 * creator who opened a game and then wandered to another page still has to
 * reveal when someone joins, and that cannot depend on which page they are on.
 * Actions live here too so each one is written once per kind of chain and the
 * pages never need to know which kind they are talking to.
 */
export function RpsPvpProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const nowFor = useChainClock();
  const rules = useChainRules();
  const { games, loading, refetch } = useMyGames(25);
  const { writeContractAsync } = useWriteContract();
  const { send, busy } = useSend();

  const meFor = React.useCallback(
    (chain: RpsChain) => (chain.kind === "evm" ? address : undefined),
    [address]
  );
  const { inFlight, problems, revealNow } = useAutoReveal(games, nowFor, meFor);

  const evmOnly = (chain: RpsChain) => {
    if (chain.kind !== "evm") throw new Error(`${chain.name} rooms are not open yet.`);
  };

  const openGame = React.useCallback(
    async (chain: RpsChain, stake: bigint, move: Move) => {
      evmOnly(chain);
      const me = meFor(chain);
      if (!me) throw new Error(`Connect a wallet to play on ${chain.name}.`);
      const salt = newSalt();
      const commitment = commitmentFor(move, salt, me as Address);
      // Saved before sending: if the tab dies after this point the game may
      // still get created, and without the secret it could never be revealed.
      saveSecret(chain.key, chain.game, commitment, { move, salt });
      await send(`open:${chain.key}`, chain, () =>
        writeContractAsync({
          chainId: chain.chainId as number,
          address: chain.game as Address,
          abi: rpsPvpAbi,
          functionName: "createGame",
          args: [stake, commitment],
        })
      );
      refetch();
    },
    [meFor, send, writeContractAsync, refetch]
  );

  const joinGame = React.useCallback(
    async (row: OpenRow, move: Move) => {
      evmOnly(row.chain);
      await send(`join:${gameKey(row)}`, row.chain, () =>
        writeContractAsync({
          chainId: row.chain.chainId as number,
          address: row.chain.game as Address,
          abi: rpsPvpAbi,
          functionName: "join",
          args: [row.id, move],
        })
      );
      refetch();
    },
    [send, writeContractAsync, refetch]
  );

  const approve = React.useCallback(
    async (chain: RpsChain) => {
      evmOnly(chain);
      const token = rules[chain.key]?.token;
      if (!token) throw new Error(`The ${chain.name} stake token has not loaded yet.`);
      // Unlimited is safe here: the game only ever pulls from the wallet that
      // is calling it, at the stake that wallet chose, and it cannot be upgraded.
      await send(`approve:${chain.key}`, chain, () =>
        writeContractAsync({
          chainId: chain.chainId as number,
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [chain.game as Address, maxUint256],
        })
      );
    },
    [rules, send, writeContractAsync]
  );

  const settleAction = React.useCallback(
    async (g: AnyGame, functionName: "cancel" | "claimUnrevealed", label: string) => {
      evmOnly(g.chain);
      await send(`${label}:${gameKey(g)}`, g.chain, () =>
        writeContractAsync({
          chainId: g.chain.chainId as number,
          address: g.chain.game as Address,
          abi: rpsPvpAbi,
          functionName,
          args: [g.id],
        })
      );
      refetch();
    },
    [send, writeContractAsync, refetch]
  );

  const cancelGame = React.useCallback((g: AnyGame) => settleAction(g, "cancel", "cancel"), [settleAction]);
  const claimGame = React.useCallback((g: AnyGame) => settleAction(g, "claimUnrevealed", "claim"), [settleAction]);

  // A found match flashes in the tab title, for a creator looking at another tab.
  const matchFound = React.useMemo(
    () =>
      games.some(
        (g) =>
          g.status === Status.Joined &&
          sameAccount(g.creator, meFor(g.chain), g.chain) &&
          g.revealBy > nowFor(g.chain.key)
      ),
    [games, meFor, nowFor]
  );

  React.useEffect(() => {
    if (!matchFound) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = on ? "⚡ MATCH FOUND" : original;
    }, 700);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [matchFound]);

  const value = React.useMemo<Value>(
    () => ({
      nowFor,
      meFor,
      anyConnected: Boolean(address),
      rules,
      games,
      loading,
      refetch: () => void refetch(),
      busy,
      inFlight,
      problems,
      revealNow,
      openGame,
      joinGame,
      approve,
      cancelGame,
      claimGame,
    }),
    [nowFor, meFor, address, rules, games, loading, refetch, busy, inFlight, problems, revealNow, openGame, joinGame, approve, cancelGame, claimGame]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRpsPvp(): Value {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useRpsPvp must be used inside RpsPvpProvider");
  return v;
}
