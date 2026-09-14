"use client";

import * as React from "react";
import { useAccount, useWriteContract } from "wagmi";
import type { Address } from "viem";

import { REQUIRED_CHAIN_ID } from "../lib/addresses";
import { useRpsPvp } from "../lib/RpsPvpContext";
import { useRpsConfig, useSend } from "../lib/useRpsPvp";
import {
  RPS_PVP_ADDRESS,
  rpsPvpAbi,
  Status,
  MOVE_LABEL,
  MOVE_EMOJI,
  countdown,
  dollars,
  shortAddr,
  outcomeFor,
  loadSecret,
} from "../lib/rpsPvp";

const GAME = RPS_PVP_ADDRESS as Address;

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

/** The connected player's games, with whatever each one needs from them next. */
export function RpsMyGames({ title, limit, emptyText }: { title: string; limit?: number; emptyText: string }) {
  const { address } = useAccount();
  const { games, now, inFlight, problems, revealNow, refetch } = useRpsPvp();
  const config = useRpsConfig();
  const { writeContractAsync } = useWriteContract();
  const { send, busy } = useSend();
  const [error, setError] = React.useState("");

  async function act(key: string, functionName: "cancel" | "claimUnrevealed", id: bigint) {
    setError("");
    try {
      await send(key, () =>
        writeContractAsync({ chainId: REQUIRED_CHAIN_ID, address: GAME, abi: rpsPvpAbi, functionName, args: [id] })
      );
      refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const shown = limit ? games.slice(0, limit) : games;
  const decimals = config.decimals ?? 6;
  const feeBps = BigInt(config.feeBps ?? 10);

  return (
    <div className="panel" style={{ padding: "16px 20px" }}>
      <div className="h2">{title}</div>
      {error && (
        <div className="tiny" style={{ color: TONE.bad, marginTop: 6 }}>
          {error}
        </div>
      )}

      {!address && <div className="muted tiny" style={{ marginTop: 8 }}>Connect a wallet to see your games.</div>}
      {address && shown.length === 0 && <div className="muted tiny" style={{ marginTop: 8 }}>{emptyText}</div>}

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {address &&
          shown.map(({ id, game: g }) => {
            const key = id.toString();
            const iAmCreator = g.creator.toLowerCase() === address.toLowerCase();
            const opponent = iAmCreator ? g.challenger : g.creator;
            const hasOpponent = !/^0x0+$/.test(opponent);

            // A creator's own move is hidden on chain until the reveal, but this
            // browser kept it.
            const myMove =
              (iAmCreator ? g.creatorMove : g.challengerMove) ||
              (iAmCreator ? loadSecret(REQUIRED_CHAIN_ID, GAME, g.commitment)?.move : undefined);
            const theirMove = iAmCreator ? g.challengerMove : g.creatorMove;
            const theirText = theirMove
              ? moveText(theirMove)
              : g.status === Status.Settled
                ? "no reveal"
                : "hidden";

            let label = "";
            let tone: Tone = "dim";
            let detail = "";
            let action: React.ReactNode = null;

            if (g.status === Status.Open) {
              const left = g.openUntil - now;
              if (left > 0) {
                label = "WAITING FOR OPPONENT";
                tone = "warn";
                detail = `stay on the site · closes in ${countdown(left)}`;
                action = (
                  <button className="btn btnBlue" disabled={busy !== null} onClick={() => act(`cancel:${key}`, "cancel", id)}>
                    {busy === `cancel:${key}` ? "…" : "CANCEL"}
                  </button>
                );
              } else {
                label = "NOBODY JOINED";
                detail = "your stake is ready to come back";
                action = (
                  <button className="btn btnMint" disabled={busy !== null} onClick={() => act(`cancel:${key}`, "cancel", id)}>
                    {busy === `cancel:${key}` ? "…" : "GET STAKE BACK"}
                  </button>
                );
              }
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
                    <button className="btn btnGold" onClick={() => revealNow(id, g)}>
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
                  <button className="btn btnGold" disabled={busy !== null} onClick={() => act(`claim:${key}`, "claimUnrevealed", id)}>
                    {busy === `claim:${key}` ? "…" : "CLAIM WIN"}
                  </button>
                );
              }
            } else if (g.status === Status.Settled) {
              const pot = g.stake * 2n;
              const fee = (pot * feeBps) / 10_000n;
              const outcome = outcomeFor(g, address);
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
                <div style={{ minWidth: 64 }}>
                  <div className="tiny muted">#{key}</div>
                  <div className="h2" style={{ fontSize: 14 }}>
                    {dollars(g.stake, decimals)}
                  </div>
                </div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div className="tiny" style={{ color: TONE[tone], fontWeight: 700 }}>
                    {label}
                  </div>
                  <div className="tiny muted">{detail}</div>
                  <div className="tiny muted">
                    you {moveText(myMove)} · {hasOpponent ? `vs ${shortAddr(opponent)} ${theirText}` : "no opponent yet"}
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
