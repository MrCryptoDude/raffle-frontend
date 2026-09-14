"use client";

import * as React from "react";
import { useAccount } from "wagmi";

import { Status } from "./rpsPvp";
import { useAutoReveal, useChainNow, useMyGames, type MyGame } from "./useRpsPvp";

type Value = {
  now: number;
  games: MyGame[];
  loading: boolean;
  refetch: () => void;
  inFlight: Set<string>;
  problems: Record<string, string>;
  revealNow: ReturnType<typeof useAutoReveal>["revealNow"];
};

const Ctx = React.createContext<Value | null>(null);

/**
 * Watches the connected player's games from every page of the site.
 *
 * Mounted once around the whole app because the reveal window is short: a
 * creator who opened a game and then wandered to another page still has to
 * reveal when someone joins, and that cannot depend on which page they are on.
 */
export function RpsPvpProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const now = useChainNow();
  const { games, loading, refetch } = useMyGames(25);
  const { inFlight, problems, revealNow } = useAutoReveal(games, now);

  // A found match flashes in the tab title, for a creator looking at another tab.
  const matchFound = React.useMemo(() => {
    if (!address) return false;
    const me = address.toLowerCase();
    return games.some(
      ({ game: g }) => g.status === Status.Joined && g.creator.toLowerCase() === me && g.revealBy > now
    );
  }, [games, address, now]);

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
    () => ({ now, games, loading, refetch: () => void refetch(), inFlight, problems, revealNow }),
    [now, games, loading, refetch, inFlight, problems, revealNow]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRpsPvp(): Value {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useRpsPvp must be used inside RpsPvpProvider");
  return v;
}
