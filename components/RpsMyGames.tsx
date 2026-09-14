"use client";

import * as React from "react";

import { ChainBadge } from "./ChainBadge";
import { useRpsPvp } from "../lib/RpsPvpContext";
import type { RpsChainKey } from "../lib/rpsChains";
import {
  Status,
  MOVE_LABEL,
  MOVE_EMOJI,
  countdown,
  dollars,
  shortAddr,
  outcomeFor,
  loadSecret,
  gameKey,
  sameAccount,
} from "../lib/rpsPvp";

type Tone = "good" | "bad" | "warn" | "dim";
const TONE: Record<Tone, string> = {
  good: "rgba(100,255,150,0.95)",
  bad: "rgba(255,120,140,0.95)",
  warn: "rgba(255,210,110,0.95)",
  dim: "rgba(200,255,222,0.55)",
};

function moveText(m?: number) {
  return m && MOVE_LABEL[m] ? `${MOVE_EMOJI[m]} ${MOVE_LABEL[m]}` : "—";
}

/** The connected player's games on every chain, with whatever each one needs next. */
export function RpsMyGames({
  title,
  limit,
  emptyText,
  only,
}: {
  title: string;
  limit?: number;
  emptyText: string;
  /** Show one chain only. */
  only?: RpsChainKey | null;
}) {
  const { games, nowFor, meFor, rules, anyConnected, busy, inFlight, problems, revealNow, cancelGame, claimGame } =
    useRpsPvp();
  const [error, setError] = React.useState("");

  async function act(run: () => Promise<void>) {
    setError("");
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const shown = games.filter((g) => !only || g.chain.key === only).slice(0, limit ?? games.length);

  return (
    <div className="panel" style={{ padding: "16px 20px" }}>
      <div className="h2">{title}</div>
      {error && (
        <div className="tiny" style={{ color: TONE.bad, marginTop: 6 }}>
          {error}
        </div>
      )}

      {!anyConnected && <div className="muted tiny" style={{ marginTop: 8 }}>Connect a wallet to see your games.</div>}
      {anyConnected && shown.length === 0 && <div className="muted tiny" style={{ marginTop: 8 }}>{emptyText}</div>}

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {shown.map((g) => {
          const key = gameKey(g);
          const me = meFor(g.chain);
          const now = nowFor(g.chain.key);
          const decimals = rules[g.chain.key]?.decimals ?? 6;
          const feeBps = BigInt(rules[g.chain.key]?.feeBps ?? 10);

          const iAmCreator = sameAccount(g.creator, me, g.chain);
          const opponent = iAmCreator ? g.challenger : g.creator;

          // A creator's own move is hidden on chain until the reveal, but this
          // browser kept it.
          const myMove =
            (iAmCreator ? g.creatorMove : g.challengerMove) ||
            (iAmCreator ? loadSecret(g.chain.key, g.chain.game, g.commitment)?.move : undefined);
          const theirMove = iAmCreator ? g.challengerMove : g.creatorMove;
          const theirText = theirMove ? moveText(theirMove) : g.status === Status.Settled ? "no reveal" : "hidden";

          let label = "";
          let tone: Tone = "dim";
          let detail = "";
          let action: React.ReactNode = null;

          if (g.status === Status.Open) {
            const left = g.openUntil - now;
            label = left > 0 ? "WAITING FOR OPPONENT" : "NOBODY JOINED";
            tone = left > 0 ? "warn" : "dim";
            detail = left > 0 ? `stay on the site · closes in ${countdown(left)}` : "your stake is ready to come back";
            action = (
              <button
                className={`btn ${left > 0 ? "btnBlue" : "btnMint"}`}
                disabled={busy !== null}
                onClick={() => act(() => cancelGame(g))}
              >
                {busy === `cancel:${key}` ? "…" : left > 0 ? "CANCEL" : "GET STAKE BACK"}
              </button>
            );
          } else if (g.status === Status.Joined) {
            const left = g.revealBy - now;
            if (iAmCreator) {
              if (left <= 0) {
                label = "REVEAL MISSED";
                tone = "bad";
                detail = "the opponent can now claim the pot";
              } else if (inFlight.has(key)) {
                label = "MATCH FOUND — REVEALING";
                tone = "warn";
                detail = `confirm in your wallet · ${countdown(left)} left`;
              } else if (problems[key]) {
                label = "REVEAL NOW";
                tone = "bad";
                detail = `${problems[key]} · ${countdown(left)} left`;
                action = (
                  <button className="btn btnGold" onClick={() => revealNow(g)}>
                    REVEAL
                  </button>
                );
              } else {
                label = "MATCH FOUND";
                tone = "warn";
                detail = `revealing · ${countdown(left)} left`;
              }
            } else if (left > 0) {
              label = "OPPONENT REVEALING";
              tone = "warn";
              detail = `${countdown(left)} left for them to reveal`;
            } else {
              label = "OPPONENT DID NOT REVEAL";
              tone = "good";
              detail = "the pot is yours to claim";
              action = (
                <button className="btn btnGold" disabled={busy !== null} onClick={() => act(() => claimGame(g))}>
                  {busy === `claim:${key}` ? "…" : "CLAIM WIN"}
                </button>
              );
            }
          } else if (g.status === Status.Settled) {
            const pot = g.stake * 2n;
            const fee = (pot * feeBps) / 10_000n;
            const outcome = outcomeFor(g, me);
            if (outcome === "WIN") {
              label = "WON";
              tone = "good";
              detail = `+${dollars(pot - fee - g.stake, decimals)}`;
            } else if (outcome === "DRAW") {
              label = "DRAW";
              detail = "stake returned";
            } else {
              label = "LOST";
              tone = "bad";
              detail = `-${dollars(g.stake, decimals)}`;
            }
          } else {
            label = "CANCELLED";
            detail = "stake returned";
          }

          return (
            <div
              key={key}
              className="inset"
              style={{ padding: "10px 12px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 76, display: "grid", gap: 3 }}>
                <ChainBadge chain={g.chain} />
                <div className="h2" style={{ fontSize: 14 }}>
                  {dollars(g.stake, decimals)}
                </div>
                <div className="tiny muted">#{g.id.toString()}</div>
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div className="tiny" style={{ color: TONE[tone], fontWeight: 700 }}>
                  {label}
                </div>
                <div className="tiny muted">{detail}</div>
                <div className="tiny muted">
                  you {moveText(myMove)} · {opponent ? `vs ${shortAddr(opponent)} ${theirText}` : "no opponent yet"}
                </div>
              </div>
              {action}
            </div>
          );
        })}
      </div>
    </div>
  );
}
