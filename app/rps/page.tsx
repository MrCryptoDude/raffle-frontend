"use client";

import * as React from "react";
import { useAccount } from "wagmi";

import { ChainBadge } from "../../components/ChainBadge";
import { MatrixRpsIcon } from "../../components/MatrixRpsIcon";
import { RpsMyGames } from "../../components/RpsMyGames";
import { useRpsPvp } from "../../lib/RpsPvpContext";
import { LIVE_RPS_CHAINS, RPS_CHAINS, type RpsChain, type RpsChainKey } from "../../lib/rpsChains";
import { useLobby, useStakeWallets, useTables, type TableRow, type TableSeat } from "../../lib/useRpsPvp";
import {
  MOVES,
  MOVE_LABEL,
  MOVE_EMOJI,
  Status,
  loadSecret,
  dollars,
  shortAddr,
  countdown,
  outcomeFor,
  gameKey,
  sameAccount,
  type Move,
  type OpenRow,
} from "../../lib/rpsPvp";

type Filter = RpsChainKey | "all";

type WalletView = { known: boolean; tooPoor: boolean; needsApproval: boolean; balance?: bigint };

type Run = (label: string, fn: () => Promise<void>) => Promise<boolean>;

export default function RpsRoomPage() {
  const { chainId: walletChainId } = useAccount();
  const { rules, nowFor, meFor, anyConnected, games } = useRpsPvp();
  const { tables: allTables } = useTables(rules);
  const { wallets } = useStakeWallets(rules);

  const [filter, setFilter] = React.useState<Filter>("all");
  const [tableDollars, setTableDollars] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<{ text: string; bad?: boolean } | null>(null);

  const tables = React.useMemo<TableRow[]>(() => {
    if (filter === "all") return allTables;
    return allTables
      .map((t) => {
        const seats = t.seats.filter((s) => s.chain.key === filter);
        return { ...t, seats, waiting: seats.reduce((n, s) => n + s.waiting, 0) };
      })
      .filter((t) => t.seats.length > 0);
  }, [allTables, filter]);

  // Land on the busiest table, or the first, once tables load or the filter changes.
  React.useEffect(() => {
    if (tables.length === 0) return;
    if (tableDollars !== null && tables.some((t) => t.dollars === tableDollars)) return;
    const busiest = [...tables].sort((a, b) => b.waiting - a.waiting)[0];
    setTableDollars(busiest.waiting > 0 ? busiest.dollars : tables[0].dollars);
  }, [tables, tableDollars]);

  const table = tables.find((t) => t.dollars === tableDollars) ?? null;
  const { rows } = useLobby(table);

  const walletFor = React.useCallback(
    (chain: RpsChain, stake: bigint): WalletView => {
      const w = wallets[chain.key];
      const known = anyConnected && w?.balance !== undefined && w?.allowance !== undefined;
      return {
        known,
        tooPoor: known && (w?.balance ?? 0n) < stake,
        needsApproval: known && (w?.allowance ?? 0n) < stake,
        balance: w?.balance,
      };
    },
    [wallets, anyConnected]
  );

  const run: Run = async (label, fn) => {
    setMessage({ text: `${label}… confirm in your wallet` });
    try {
      await fn();
      setMessage({ text: `${label} done` });
      return true;
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true });
      return false;
    }
  };

  // ----- The arena shows whichever of your games matters most right now -----

  const featured = React.useMemo(
    () =>
      games.find((g) => g.status === Status.Joined) ??
      games.find((g) => g.status === Status.Open && g.openUntil > nowFor(g.chain.key)) ??
      games.find((g) => g.status === Status.Settled),
    [games, nowFor]
  );

  const live = featured !== undefined && (featured.status === Status.Open || featured.status === Status.Joined);
  const [seed, setSeed] = React.useState(1);
  const [noise, setNoise] = React.useState<Move>(1);

  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setSeed((s) => (s + 1337) >>> 0);
      setNoise((Math.floor(Math.random() * 3) + 1) as Move);
    }, 160);
    return () => clearInterval(id);
  }, [live]);

  let arenaMine = 1;
  let arenaTheirs = 1;
  let arenaCenter = "PICK A TABLE";
  let arenaTone = "rgba(0,255,140,0.6)";
  let arenaOpponent: string | null = null;

  if (featured) {
    const g = featured;
    const me = meFor(g.chain);
    const iAmCreator = sameAccount(g.creator, me, g.chain);
    const mine =
      (iAmCreator ? g.creatorMove : g.challengerMove) ||
      (iAmCreator ? (loadSecret(g.chain.key, g.chain.game, g.commitment)?.move ?? 0) : 0);
    const theirs = iAmCreator ? g.challengerMove : g.creatorMove;
    arenaMine = mine || noise;
    arenaTheirs = theirs || noise;
    arenaOpponent = iAmCreator ? g.challenger : g.creator;
    const now = nowFor(g.chain.key);

    if (g.status === Status.Open) {
      arenaCenter = `WAITING ${countdown(g.openUntil - now)}`;
    } else if (g.status === Status.Joined) {
      arenaCenter = `${iAmCreator ? "REVEAL" : "REVEALING"} ${countdown(g.revealBy - now)}`;
      arenaTone = "rgba(255,210,110,0.95)";
    } else {
      const o = outcomeFor(g, me);
      arenaCenter = o === "WIN" ? "YOU WIN" : o === "LOSS" ? "YOU LOSE" : "DRAW";
      arenaTone = o === "WIN" ? "#00ff8c" : o === "LOSS" ? "#ff6b8a" : "#ffd700";
    }
  }

  const headlineRules = LIVE_RPS_CHAINS[0] ? rules[LIVE_RPS_CHAINS[0].key] : undefined;

  return (
    <main className="screen">
      <style>{`
        @keyframes matrixFloat { 0%{transform:translateY(0);opacity:.95} 50%{transform:translateY(-6px);opacity:1} 100%{transform:translateY(0);opacity:.95} }
        @keyframes matrixFloatSlow { 0%{transform:translateY(0);opacity:.85} 50%{transform:translateY(-2px);opacity:.9} 100%{transform:translateY(0);opacity:.85} }
        .matrixFloat { animation: matrixFloat .55s ease-in-out infinite; }
        .matrixFloatSlow { animation: matrixFloatSlow 2s ease-in-out infinite; }
        .rpsArena { display:grid; grid-template-columns:1fr auto 1fr; gap:16px; align-items:center; padding:16px; }
        .rpsSide { display:flex; flex-direction:column; align-items:center; text-align:center; }
        .rpsIcon { width:120px; height:120px; max-width:100%; }
        .rpsCenter { display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; }
        .pvpStack { display:grid; gap:16px; margin-top:16px; }
        .pvpChips { display:flex; flex-wrap:wrap; gap:8px; }
        .pvpChips .btn { display:inline-flex; align-items:center; gap:6px; }
        .pvpChips .btn.on, .pvpTable.on, .pvpMoves .btn.on { box-shadow:0 0 18px rgba(0,255,140,.45); border-color:rgba(0,255,140,1); }
        .pvpTables { display:grid; grid-template-columns:repeat(auto-fill, minmax(104px, 1fr)); gap:8px; margin-top:10px; }
        .pvpTable { display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 6px; }
        .pvpAmount { font-size:15px; font-weight:700; }
        .pvpSeats { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; }
        .pvpMoves { display:flex; gap:8px; }
        .pvpMoves .btn { flex:1; }
        .pvpRow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 12px; }
        .pvpJoin { display:flex; gap:6px; margin-left:auto; align-items:center; }
        .pvpJoin .btn { padding-left:10px; padding-right:10px; }
        .pvpCols { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.3fr); gap:16px; }
        @media (max-width: 760px) { .pvpCols { grid-template-columns:1fr; } .pvpJoin { margin-left:0; width:100%; } .pvpJoin .btn { flex:1; } }
        @media (max-width: 600px) { .rpsIcon { width:84px; height:84px; } .rpsArena { gap:8px; padding:12px; } }
      `}</style>

      <div className="panel marqueePanel" style={{ padding: "16px 20px", textAlign: "center" }}>
        <div className="h1">ROCK PAPER SCISSORS</div>
        <div className="muted tiny" style={{ marginTop: 8 }}>
          PLAYER VS PLAYER · EVERY ROOM PLAYS ON ONE CHAIN · 0.1% FEE ON WINS · {headlineRules?.revealWindow ?? 30}S REVEAL
        </div>
        {message && (
          <div className="tiny" style={{ marginTop: 8, color: message.bad ? "#ff6b8a" : undefined }}>
            {message.text}
          </div>
        )}
      </div>

      {LIVE_RPS_CHAINS.length === 0 ? (
        <div className="panel" style={{ padding: "16px 20px", marginTop: 16 }}>
          <div className="muted tiny">The player-versus-player game is not deployed yet.</div>
        </div>
      ) : (
        <div className="pvpStack">
          <div className="panel rpsArena">
            <div className="rpsSide">
              <div className="muted tiny">YOU</div>
              <div style={{ marginTop: 8 }}>
                <MatrixRpsIcon move={arenaMine} tag="P1" isRevealing={live} seed={seed} />
              </div>
            </div>
            <div className="rpsCenter">
              <div className="tiny" style={{ letterSpacing: "0.2em", color: "rgba(0,255,140,0.7)" }}>VS</div>
              <div className="h2" style={{ color: arenaTone, fontSize: 13 }}>{arenaCenter}</div>
              {featured && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <ChainBadge chain={featured.chain} />
                  <span className="tiny muted">
                    #{featured.id.toString()} · {dollars(featured.stake, rules[featured.chain.key]?.decimals ?? 6)}
                  </span>
                </div>
              )}
            </div>
            <div className="rpsSide">
              <div className="muted tiny">OPPONENT</div>
              <div className="tiny" style={{ opacity: 0.7 }}>{arenaOpponent ? shortAddr(arenaOpponent) : "—"}</div>
              <div style={{ marginTop: 8 }}>
                <MatrixRpsIcon move={arenaTheirs} tag="P2" isRevealing={live} seed={seed + 99} />
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: "16px 20px" }}>
            <div className="h2">TABLES</div>
            <div className="muted tiny">
              Each room plays on one chain, with that chain&apos;s dollar token. Winnings are paid on the chain you
              played on — bridging between chains is up to you.
            </div>

            <div className="pvpChips" style={{ marginTop: 10 }}>
              <button className={`btn btnGold ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>
                ALL CHAINS
              </button>
              {RPS_CHAINS.map((c) => {
                const isLive = c.game !== "";
                return (
                  <button
                    key={c.key}
                    className={`btn btnGold ${filter === c.key ? "on" : ""}`}
                    disabled={!isLive}
                    title={isLive ? `Only ${c.name} rooms` : `${c.name} rooms are coming soon`}
                    onClick={() => setFilter(c.key)}
                  >
                    <ChainBadge chain={c} size="md" />
                    {!isLive && <span className="tiny muted">SOON</span>}
                  </button>
                );
              })}
            </div>

            <div className="pvpTables">
              {tables.map((t) => (
                <button
                  key={t.dollars}
                  className={`btn btnGold pvpTable ${table?.dollars === t.dollars ? "on" : ""}`}
                  onClick={() => setTableDollars(t.dollars)}
                >
                  <span className="pvpAmount">${t.dollars}</span>
                  <span className="tiny" style={{ opacity: t.waiting ? 1 : 0.55 }}>
                    {t.waiting ? `${t.waiting} waiting` : "empty"}
                  </span>
                  {t.waiting > 0 && (
                    <span className="pvpSeats">
                      {t.seats
                        .filter((s) => s.waiting > 0)
                        .map((s) => (
                          <span key={s.chain.key} className="tiny" style={{ color: s.chain.color, fontWeight: 700 }}>
                            {s.chain.badge} {s.waiting}
                          </span>
                        ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {table && (
            <div className="pvpCols">
              <OpenPanel table={table} walletChainId={walletChainId} walletFor={walletFor} run={run} />
              <LobbyPanel table={table} rows={rows} walletFor={walletFor} run={run} />
            </div>
          )}

          <RpsMyGames title="YOUR GAMES" limit={10} emptyText="No games yet. Open one or join someone above." />
        </div>
      )}
    </main>
  );
}

/** Open a game at the chosen table, on the chosen chain. */
function OpenPanel({
  table,
  walletChainId,
  walletFor,
  run,
}: {
  table: TableRow;
  walletChainId?: number;
  walletFor: (chain: RpsChain, stake: bigint) => WalletView;
  run: Run;
}) {
  const { rules, anyConnected, busy, openGame, approve } = useRpsPvp();
  const [openOn, setOpenOn] = React.useState<RpsChainKey | null>(null);
  const [move, setMove] = React.useState<Move | null>(null);

  // The chain picked, else the one the wallet is already on, else the first.
  const seat: TableSeat =
    table.seats.find((s) => s.chain.key === openOn) ??
    table.seats.find((s) => s.chain.chainId === walletChainId) ??
    table.seats[0];

  const chain = seat.chain;
  const chainRules = rules[chain.key];
  const symbol = chainRules?.symbol ?? "USD";
  const wallet = walletFor(chain, seat.stake);
  const needsSwitch = anyConnected && chain.chainId !== undefined && walletChainId !== chain.chainId;

  return (
    <div className="panel" style={{ padding: "16px 20px" }}>
      <div className="h2">OPEN A ${table.dollars} GAME</div>

      <div className="muted tiny" style={{ marginTop: 6 }}>Play on</div>
      <div className="pvpChips" style={{ marginTop: 4 }}>
        {table.seats.map((s) => (
          <button
            key={s.chain.key}
            className={`btn btnGold ${s.chain.key === chain.key ? "on" : ""}`}
            onClick={() => setOpenOn(s.chain.key)}
          >
            <ChainBadge chain={s.chain} size="md" />
          </button>
        ))}
      </div>

      <div className="muted tiny" style={{ marginTop: 10 }}>
        Your stake and anything you win stay on {chain.name}. Your move stays hidden until someone joins; then your
        wallet asks you to confirm the reveal — you have {chainRules?.revealWindow ?? 30} seconds, or you forfeit. Stay
        on the site while you wait. Nobody can join after {Math.round((chainRules?.joinWindow ?? 600) / 60)} minutes,
        and you can cancel any time before.
      </div>

      <div className="pvpMoves" style={{ marginTop: 12 }}>
        {MOVES.map((m) => (
          <button
            key={m}
            className={`btn btnGold ${move === m ? "on" : ""}`}
            onClick={() => setMove(m)}
            disabled={!anyConnected || busy !== null}
          >
            {MOVE_EMOJI[m]} {MOVE_LABEL[m]}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {!anyConnected ? (
          <div className="muted tiny">Connect a wallet to play.</div>
        ) : !wallet.known ? (
          <button className="btn" style={{ width: "100%" }} disabled>
            …
          </button>
        ) : wallet.tooPoor ? (
          <button className="btn" style={{ width: "100%" }} disabled>
            NOT ENOUGH {symbol} ON {chain.badge}
          </button>
        ) : wallet.needsApproval ? (
          <button
            className="btn btnMint"
            style={{ width: "100%" }}
            disabled={busy !== null}
            onClick={() => run(`Approving ${symbol} on ${chain.name}`, () => approve(chain))}
          >
            {busy === `approve:${chain.key}` ? "APPROVING…" : `APPROVE ${symbol} ON ${chain.badge}`}
          </button>
        ) : (
          <button
            className="btn btnBlue"
            style={{ width: "100%" }}
            disabled={move === null || busy !== null}
            onClick={async () => {
              if (move === null) return;
              const ok = await run(`Opening a $${table.dollars} game on ${chain.name}`, () =>
                openGame(chain, seat.stake, move)
              );
              if (ok) setMove(null);
            }}
          >
            {busy === `open:${chain.key}`
              ? "OPENING…"
              : move === null
                ? "PICK A MOVE"
                : `OPEN ON ${chain.badge} WITH ${MOVE_LABEL[move]}`}
          </button>
        )}
      </div>

      {anyConnected && wallet.balance !== undefined && (
        <div className="muted tiny" style={{ marginTop: 8 }}>
          Balance on {chain.name}: {dollars(wallet.balance, chainRules?.decimals ?? 6)} {symbol}
          {wallet.tooPoor && ` · bridge ${symbol} to ${chain.name} to play here`}
          {needsSwitch && ` · your wallet will switch to ${chain.name}`}
        </div>
      )}
    </div>
  );
}

/** Everyone waiting at the chosen table, whichever chain they are on. */
function LobbyPanel({
  table,
  rows,
  walletFor,
  run,
}: {
  table: TableRow;
  rows: OpenRow[];
  walletFor: (chain: RpsChain, stake: bigint) => WalletView;
  run: Run;
}) {
  const { rules, nowFor, meFor, anyConnected, busy, joinGame, approve } = useRpsPvp();

  return (
    <div className="panel" style={{ padding: "16px 20px" }}>
      <div className="h2">
        WAITING AT ${table.dollars} ({rows.length})
      </div>
      <div className="muted tiny">Join with a move. Theirs is already locked in. You play on their chain.</div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {rows.length === 0 && (
          <div className="inset muted tiny" style={{ padding: "10px 12px" }}>
            Nobody is waiting here. Open a game and be the first.
          </div>
        )}
        {rows.map((row) => {
          const mine = sameAccount(row.creator, meFor(row.chain), row.chain);
          const key = `join:${gameKey(row)}`;
          const symbol = rules[row.chain.key]?.symbol ?? "USD";
          const wallet = walletFor(row.chain, row.stake);

          return (
            <div key={gameKey(row)} className="inset pvpRow">
              <ChainBadge chain={row.chain} size="md" />
              <div style={{ minWidth: 0 }}>
                <div className="tiny">{mine ? "YOUR GAME" : shortAddr(row.creator)}</div>
                <div className="tiny muted">
                  #{row.id.toString()} · closes in {countdown(row.openUntil - nowFor(row.chain.key))}
                </div>
              </div>
              {!mine && (
                <div className="pvpJoin">
                  {!anyConnected ? (
                    <span className="tiny muted">Connect a wallet to join</span>
                  ) : !wallet.known ? (
                    <span className="tiny muted">…</span>
                  ) : wallet.tooPoor ? (
                    <span className="tiny muted">
                      Not enough {symbol} on {row.chain.name}
                    </span>
                  ) : wallet.needsApproval ? (
                    <button
                      className="btn btnMint"
                      disabled={busy !== null}
                      onClick={() => run(`Approving ${symbol} on ${row.chain.name}`, () => approve(row.chain))}
                    >
                      {busy === `approve:${row.chain.key}` ? "…" : `APPROVE ${symbol}`}
                    </button>
                  ) : (
                    MOVES.map((m) => (
                      <button
                        key={m}
                        className="btn btnBlue"
                        title={`Join with ${MOVE_LABEL[m]} on ${row.chain.name}`}
                        disabled={busy !== null}
                        onClick={() => run(`Joining on ${row.chain.name} with ${MOVE_LABEL[m]}`, () => joinGame(row, m))}
                      >
                        {busy === key ? "…" : MOVE_EMOJI[m]}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
