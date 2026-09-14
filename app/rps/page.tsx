"use client";

import * as React from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi, maxUint256, type Address } from "viem";

import { REQUIRED_CHAIN_ID } from "../../lib/addresses";
import { MatrixRpsIcon } from "../../components/MatrixRpsIcon";
import { RpsMyGames } from "../../components/RpsMyGames";
import { useRpsPvp } from "../../lib/RpsPvpContext";
import { useLobby, useRpsConfig, useSend, useTables } from "../../lib/useRpsPvp";
import {
  RPS_PVP_ADDRESS,
  rpsPvpAbi,
  MOVES,
  MOVE_LABEL,
  MOVE_EMOJI,
  Status,
  commitmentFor,
  newSalt,
  saveSecret,
  loadSecret,
  dollars,
  shortAddr,
  countdown,
  outcomeFor,
  type Move,
} from "../../lib/rpsPvp";

const GAME = RPS_PVP_ADDRESS as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export default function RpsRoomPage() {
  const { address, isConnected } = useAccount();
  const config = useRpsConfig();
  const { tables, refetch: refetchTables } = useTables();
  const { games, now, refetch: refetchMine } = useRpsPvp();
  const { writeContractAsync } = useWriteContract();
  const { send, busy } = useSend();

  const [table, setTable] = React.useState<bigint | null>(null);
  const [openMove, setOpenMove] = React.useState<Move | null>(null);
  const [message, setMessage] = React.useState<{ text: string; bad?: boolean } | null>(null);

  const { rows, refetch: refetchLobby } = useLobby(table);
  const decimals = config.decimals ?? 6;
  const symbol = config.symbol ?? "USDC";

  // Land on the busiest table, or the first, once the ladder loads.
  React.useEffect(() => {
    if (table !== null || tables.length === 0) return;
    const busiest = [...tables].sort((a, b) => b.waiting - a.waiting)[0];
    setTable(busiest.waiting > 0 ? busiest.stake : tables[0].stake);
  }, [tables, table]);

  const allowanceQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    address: config.token as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? ZERO, GAME],
    query: { enabled: Boolean(address && config.token), refetchInterval: 3000 },
  });
  const balanceQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    address: config.token as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? ZERO],
    query: { enabled: Boolean(address && config.token), refetchInterval: 3000 },
  });

  const allowance = allowanceQ.data ?? 0n;
  const balance = balanceQ.data ?? 0n;
  // Unknown until both have loaded; guessing either way would flash the wrong prompt.
  const walletKnown = isConnected && allowanceQ.data !== undefined && balanceQ.data !== undefined;
  const needsApproval = walletKnown && table !== null && allowance < table;
  const tooPoor = walletKnown && table !== null && balance < table;

  function refreshAll() {
    refetchTables();
    refetchLobby();
    refetchMine();
    allowanceQ.refetch();
    balanceQ.refetch();
  }

  async function run(key: string, label: string, submit: () => Promise<`0x${string}`>) {
    setMessage({ text: `${label}… confirm in your wallet` });
    try {
      await send(key, submit);
      setMessage({ text: `${label} done` });
      refreshAll();
      return true;
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true });
      return false;
    }
  }

  async function approve() {
    if (!config.token) return;
    // Unlimited is safe here: the game only ever pulls from the wallet that is
    // calling it, at the stake that wallet chose, and it cannot be upgraded.
    await run("approve", `Approving ${symbol}`, () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        address: config.token as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [GAME, maxUint256],
      })
    );
  }

  async function openGame() {
    if (!address || table === null || openMove === null) return;
    const salt = newSalt();
    const commitment = commitmentFor(openMove, salt, address);
    // Saved before sending: if the tab dies after this point the game may
    // still get created, and without the secret it could never be revealed.
    saveSecret(REQUIRED_CHAIN_ID, GAME, commitment, { move: openMove, salt });

    const ok = await run("open", `Opening a ${dollars(table, decimals)} game`, () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        address: GAME,
        abi: rpsPvpAbi,
        functionName: "createGame",
        args: [table, commitment],
      })
    );
    if (ok) setOpenMove(null);
  }

  async function joinGame(id: bigint, move: Move) {
    await run(`join:${id}`, `Joining with ${MOVE_LABEL[move]}`, () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        address: GAME,
        abi: rpsPvpAbi,
        functionName: "join",
        args: [id, move],
      })
    );
  }

  // ----- The arena shows whichever of your games matters most right now -----

  const featured = React.useMemo(() => {
    return (
      games.find(({ game: g }) => g.status === Status.Joined) ??
      games.find(({ game: g }) => g.status === Status.Open && g.openUntil > now) ??
      games.find(({ game: g }) => g.status === Status.Settled)
    );
  }, [games, now]);

  const live = featured !== undefined && (featured.game.status === Status.Open || featured.game.status === Status.Joined);
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

  if (featured && address) {
    const g = featured.game;
    const iAmCreator = g.creator.toLowerCase() === address.toLowerCase();
    const mine =
      (iAmCreator ? g.creatorMove : g.challengerMove) ||
      (iAmCreator ? loadSecret(REQUIRED_CHAIN_ID, GAME, g.commitment)?.move ?? 0 : 0);
    const theirs = iAmCreator ? g.challengerMove : g.creatorMove;
    arenaMine = mine || noise;
    arenaTheirs = theirs || noise;

    if (g.status === Status.Open) {
      arenaCenter = `WAITING ${countdown(g.openUntil - now)}`;
    } else if (g.status === Status.Joined) {
      arenaCenter = `${iAmCreator ? "REVEAL" : "REVEALING"} ${countdown(g.revealBy - now)}`;
      arenaTone = "rgba(255,210,110,0.95)";
    } else {
      const o = outcomeFor(g, address);
      arenaCenter = o === "WIN" ? "YOU WIN" : o === "LOSS" ? "YOU LOSE" : "DRAW";
      arenaTone = o === "WIN" ? "#00ff8c" : o === "LOSS" ? "#ff6b8a" : "#ffd700";
    }
  }

  const lobbyRows = [...rows].sort((a, b) => Number(a.createdAt - b.createdAt));

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
        .pvpTables { display:grid; grid-template-columns:repeat(auto-fill, minmax(92px, 1fr)); gap:8px; margin-top:10px; }
        .pvpTable { display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 6px; }
        .pvpTable.on { box-shadow:0 0 18px rgba(0,255,140,.45); border-color:rgba(0,255,140,1); }
        .pvpAmount { font-size:15px; font-weight:700; }
        .pvpMoves { display:flex; gap:8px; }
        .pvpMoves .btn { flex:1; }
        .pvpMoves .btn.on { box-shadow:0 0 18px rgba(0,255,140,.5); border-color:rgba(0,255,140,1); }
        .pvpRow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 12px; }
        .pvpJoin { display:flex; gap:6px; margin-left:auto; }
        .pvpJoin .btn { padding-left:10px; padding-right:10px; }
        .pvpCols { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.3fr); gap:16px; }
        @media (max-width: 760px) { .pvpCols { grid-template-columns:1fr; } .pvpJoin { margin-left:0; width:100%; } .pvpJoin .btn { flex:1; } }
        @media (max-width: 600px) { .rpsIcon { width:84px; height:84px; } .rpsArena { gap:8px; padding:12px; } }
      `}</style>

      <div className="panel marqueePanel" style={{ padding: "16px 20px", textAlign: "center" }}>
        <div className="h1">ROCK PAPER SCISSORS</div>
        <div className="muted tiny" style={{ marginTop: 8 }}>
          PLAYER VS PLAYER · {symbol} · 0.1% FEE ON WINS · {config.revealWindow ?? 30}S REVEAL
        </div>
        {message && (
          <div className="tiny" style={{ marginTop: 8, color: message.bad ? "#ff6b8a" : undefined }}>
            {message.text}
          </div>
        )}
      </div>

      {!config.deployed ? (
        <div className="panel" style={{ padding: "16px 20px", marginTop: 16 }}>
          <div className="muted tiny">The player-versus-player game is not deployed yet.</div>
        </div>
      ) : (
        <div className="pvpStack">
          <div className="panel rpsArena">
            <div className="rpsSide">
              <div className="muted tiny">YOU</div>
              <div className="tiny" style={{ opacity: 0.7 }}>{shortAddr(address)}</div>
              <div style={{ marginTop: 8 }}>
                <MatrixRpsIcon move={arenaMine} tag="P1" isRevealing={live} seed={seed} />
              </div>
            </div>
            <div className="rpsCenter">
              <div className="tiny" style={{ letterSpacing: "0.2em", color: "rgba(0,255,140,0.7)" }}>VS</div>
              <div className="h2" style={{ color: arenaTone, fontSize: 13 }}>{arenaCenter}</div>
              {featured && <div className="tiny muted">#{featured.id.toString()} · {dollars(featured.game.stake, decimals)}</div>}
            </div>
            <div className="rpsSide">
              <div className="muted tiny">OPPONENT</div>
              <div className="tiny" style={{ opacity: 0.7 }}>
                {featured && address
                  ? shortAddr(
                      featured.game.creator.toLowerCase() === address.toLowerCase()
                        ? /^0x0+$/.test(featured.game.challenger)
                          ? undefined
                          : featured.game.challenger
                        : featured.game.creator
                    )
                  : "—"}
              </div>
              <div style={{ marginTop: 8 }}>
                <MatrixRpsIcon move={arenaTheirs} tag="P2" isRevealing={live} seed={seed + 99} />
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: "16px 20px" }}>
            <div className="h2">TABLES</div>
            <div className="muted tiny">Everyone at a table plays for the same amount.</div>
            <div className="pvpTables">
              {tables.map((t) => (
                <button
                  key={t.stake.toString()}
                  className={`btn btnGold pvpTable ${table === t.stake ? "on" : ""}`}
                  onClick={() => setTable(t.stake)}
                >
                  <span className="pvpAmount">{dollars(t.stake, decimals)}</span>
                  <span className="tiny" style={{ opacity: t.waiting ? 1 : 0.55 }}>
                    {t.waiting ? `${t.waiting} waiting` : "empty"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {table !== null && (
            <div className="pvpCols">
              <div className="panel" style={{ padding: "16px 20px" }}>
                <div className="h2">OPEN A {dollars(table, decimals)} GAME</div>
                <div className="muted tiny" style={{ marginTop: 6 }}>
                  Your move stays hidden until someone joins. When they do, your wallet asks you to confirm the
                  reveal — you have {config.revealWindow ?? 30} seconds, or you forfeit. Stay on the site while
                  you wait. Nobody can join after {Math.round((config.joinWindow ?? 600) / 60)} minutes, and you
                  can cancel any time before.
                </div>

                <div className="pvpMoves" style={{ marginTop: 12 }}>
                  {MOVES.map((m) => (
                    <button
                      key={m}
                      className={`btn btnGold ${openMove === m ? "on" : ""}`}
                      onClick={() => setOpenMove(m)}
                      disabled={!isConnected || busy !== null}
                    >
                      {MOVE_EMOJI[m]} {MOVE_LABEL[m]}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  {!isConnected ? (
                    <div className="muted tiny">Connect a wallet to play.</div>
                  ) : tooPoor ? (
                    <button className="btn w-full" style={{ width: "100%" }} disabled>
                      NOT ENOUGH {symbol}
                    </button>
                  ) : needsApproval ? (
                    <button className="btn btnMint" style={{ width: "100%" }} onClick={approve} disabled={busy !== null}>
                      {busy === "approve" ? "APPROVING…" : `APPROVE ${symbol}`}
                    </button>
                  ) : (
                    <button
                      className="btn btnBlue"
                      style={{ width: "100%" }}
                      onClick={openGame}
                      disabled={openMove === null || busy !== null || !walletKnown}
                    >
                      {busy === "open" ? "OPENING…" : openMove === null ? "PICK A MOVE" : `OPEN GAME WITH ${MOVE_LABEL[openMove]}`}
                    </button>
                  )}
                </div>
                {isConnected && (
                  <div className="muted tiny" style={{ marginTop: 8 }}>
                    Balance {dollars(balance, decimals)} {symbol}
                  </div>
                )}
              </div>

              <div className="panel" style={{ padding: "16px 20px" }}>
                <div className="h2">WAITING AT {dollars(table, decimals)} ({lobbyRows.length})</div>
                <div className="muted tiny">Join with a move. Theirs is already locked in.</div>

                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {lobbyRows.length === 0 && (
                    <div className="inset muted tiny" style={{ padding: "10px 12px" }}>
                      Nobody is waiting here. Open a game and be the first.
                    </div>
                  )}
                  {lobbyRows.map((row) => {
                    const mine = address && row.creator.toLowerCase() === address.toLowerCase();
                    const key = `join:${row.id}`;
                    return (
                      <div key={row.id.toString()} className="inset pvpRow">
                        <div style={{ minWidth: 0 }}>
                          <div className="tiny">{mine ? "YOUR GAME" : shortAddr(row.creator)}</div>
                          <div className="tiny muted">
                            #{row.id.toString()} · closes in {countdown(Number(row.openUntil) - now)}
                          </div>
                        </div>
                        {!mine && (
                          <div className="pvpJoin">
                            {!walletKnown || needsApproval || tooPoor ? (
                              <span className="tiny muted">
                                {!isConnected
                                  ? "Connect a wallet to join"
                                  : !walletKnown
                                    ? "…"
                                    : tooPoor
                                      ? `Not enough ${symbol}`
                                      : `Approve ${symbol} to join`}
                              </span>
                            ) : (
                              MOVES.map((m) => (
                                <button
                                  key={m}
                                  className="btn btnBlue"
                                  title={`Join with ${MOVE_LABEL[m]}`}
                                  onClick={() => joinGame(row.id, m)}
                                  disabled={!isConnected || busy !== null}
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
            </div>
          )}

          <RpsMyGames title="YOUR GAMES" limit={10} emptyText="No games yet. Open one or join someone above." />
        </div>
      )}
    </main>
  );
}
