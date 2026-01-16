"use client";

import * as React from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { formatUnits, keccak256, encodePacked, parseUnits } from "viem";

import { addresses, REQUIRED_CHAIN_ID, USDC_DECIMALS } from "../../lib/addresses";
import { erc20Abi, rpsAbi } from "../../lib/abis";

const BET_LABELS = ["$1", "$2", "$5", "$10", "$25", "$50", "$100"] as const;

const BET_AMOUNTS = [1, 2, 5, 10, 25, 50, 100].map((n) =>
  parseUnits(n.toString(), USDC_DECIMALS)
);

type Choice = 1 | 2 | 3; // 1=Rock 2=Paper 3=Scissors

function shortAddr(a?: `0x${string}`) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function randSalt32(): `0x${string}` {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return (`0x${Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`) as `0x${string}`;
}

function choiceLabel(c: number) {
  if (c === 1) return "ROCK";
  if (c === 2) return "PAPER";
  if (c === 3) return "SCISSORS";
  return "—";
}

export default function RpsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  const { writeContractAsync, isPending } = useWriteContract();

  const [betIndex, setBetIndex] = React.useState<number | null>(null);
  const [step, setStep] = React.useState<"idle" | "pick" | "queued" | "matched" | "finalized">("idle");
  const [status, setStatus] = React.useState<string>("");

  const [matchId, setMatchId] = React.useState<bigint | null>(null);

  // Commit data must persist until reveal
  const [myChoice, setMyChoice] = React.useState<Choice | null>(null);
  const [mySalt, setMySalt] = React.useState<`0x${string}` | null>(null);

  const betAmount = betIndex === null ? 0n : BET_AMOUNTS[betIndex];

  // ---- helpers for storage ----
  function storageKey(mid: bigint) {
    if (!address) return null;
    return `rps:${addresses.rps}:${address.toLowerCase()}:match:${mid.toString()}`;
  }

  function saveCommit(mid: bigint, choice: Choice, salt: `0x${string}`) {
    const key = storageKey(mid);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify({ choice, salt }));
  }

  function loadCommit(mid: bigint): { choice: Choice; salt: `0x${string}` } | null {
    const key = storageKey(mid);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { choice: Choice; salt: `0x${string}` };
    } catch {
      return null;
    }
  }

  async function tx(label: string, fn: () => Promise<unknown>) {
    try {
      setStatus(label);
      const res: any = await fn();
      if (typeof res === "string") setStatus(`${label} (tx: ${res.slice(0, 10)}...)`);
      else setStatus(`${label} SENT`);
    } catch (e: any) {
      setStatus(`ERROR: ${e?.shortMessage || e?.message || "TX failed"}`);
      console.error(e);
    } finally {
      setTimeout(() => setStatus(""), 6500);
    }
  }

  // ---- allow users to approve USDC for RPS contract ----
  const allowanceQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: addresses.usdc,
    functionName: "allowance",
    args: [
      (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      addresses.rps,
    ],
    query: { enabled: !!address && !wrongNetwork, refetchInterval: 2000 },
  });

  const allowance = allowanceQ.data ?? 0n;
  const needsApproval = !!address && betAmount > 0n && allowance < betAmount;

  async function approve() {
    if (!address || wrongNetwork || betIndex === null) return;
    await tx("APPROVING", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: erc20Abi,
        address: addresses.usdc,
        functionName: "approve",
        args: [addresses.rps, betAmount],
      })
    );
  }

  // ---- match watcher: capture matchId from Committed(matchId, betIndex, player) ----
  useWatchContractEvent({
    chainId: REQUIRED_CHAIN_ID,
    abi: rpsAbi,
    address: addresses.rps,
    eventName: "Committed",
    onLogs: (logs) => {
      if (!address) return;

      for (const log of logs) {
        const args: any = (log as any).args;
        const mid = args?.matchId as bigint | undefined;
        const player = args?.player as `0x${string}` | undefined;

        if (!mid || !player) continue;
        if (player.toLowerCase() !== address.toLowerCase()) continue;

        setMatchId(mid);

        // If we already have choice+salt in memory, persist immediately
        if (myChoice && mySalt) {
          saveCommit(mid, myChoice, mySalt);
        }
      }
    },
  });

  // ---- read match once we have matchId ----
  const matchQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: rpsAbi,
    address: addresses.rps,
    functionName: "getMatch",
    args: matchId ? [matchId] : undefined,
    query: { enabled: !!matchId && !!address && !wrongNetwork, refetchInterval: 1200 },
  });

  const m = matchQ.data;
  const mStatus = m ? Number(m.status) : 0; // 1 waiting, 2 reveal, 3 finalized, 4 cancelled
  const p1 = m?.p1 as `0x${string}` | undefined;
  const p2 = m?.p2 as `0x${string}` | undefined;

  const revealed1 = m?.revealed1 ?? false;
  const revealed2 = m?.revealed2 ?? false;

  React.useEffect(() => {
    if (!matchId || !m) return;
    if (mStatus === 1) setStep("queued");
    else if (mStatus === 2) setStep("matched");
    else if (mStatus === 3) setStep("finalized");
  }, [matchId, m, mStatus]);

  function startPlay() {
    if (!address || wrongNetwork || betIndex === null) return;
    setStep("pick");
  }

  async function commitMove(choice: Choice) {
    if (!address || wrongNetwork || betIndex === null) return;

    const salt = randSalt32();
    const commitment = keccak256(
      encodePacked(["address", "uint8", "bytes32"], [address, choice, salt])
    );

    setMyChoice(choice);
    setMySalt(salt);

    await tx("COMMITTING", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: rpsAbi,
        address: addresses.rps,
        functionName: "commit",
        args: [betIndex, commitment],
      })
    );

    // After tx, watcher will set matchId. Until then show queued UI.
    setStep("queued");
  }

  async function reveal() {
    if (!address || wrongNetwork || !matchId) return;

    // restore choice/salt if refreshed
    let choice = myChoice;
    let salt = mySalt;

    if (!choice || !salt) {
      const saved = loadCommit(matchId);
      if (saved) {
        choice = saved.choice;
        salt = saved.salt;
        setMyChoice(choice);
        setMySalt(salt);
      }
    }

    if (!choice || !salt) {
      setStatus("ERROR: Missing commit data (choice/salt).");
      return;
    }

    await tx("REVEALING", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: rpsAbi,
        address: addresses.rps,
        functionName: "reveal",
        args: [matchId, choice, salt],
      })
    );
  }

  async function cancel() {
    if (!address || wrongNetwork || !matchId) return;
    await tx("CANCELLING", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: rpsAbi,
        address: addresses.rps,
        functionName: "cancel",
        args: [matchId],
      })
    );
  }

  async function claimTimeout() {
    if (!address || wrongNetwork || !matchId) return;
    await tx("CLAIMING TIMEOUT", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: rpsAbi,
        address: addresses.rps,
        functionName: "claimTimeout",
        args: [matchId],
      })
    );
  }

  return (
    <main className="screen">
      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="h1">RPS</div>
        <div className="muted tiny mt-2">ROCK • PAPER • SCISSORS — 1% TO STAKERS</div>
        {status && <div className="muted tiny mt-2">{status}</div>}
        {wrongNetwork && <div className="danger tiny mt-2">SWITCH TO BASE SEPOLIA</div>}
      </div>

      <div className="panel potCard cabinetPot" style={{ maxWidth: 520, margin: "22px auto 0" }}>
        <div className="h2">MATCHMAKING</div>

        <div className="mt-3 inset statBox">
          <div className="muted tiny">YOUR ADDRESS</div>
          <div className="tiny">{address ? shortAddr(address) : "—"}</div>
        </div>

        <div className="mt-3 inset statBox">
          <div className="muted tiny">MATCH</div>
          <div className="tiny">{matchId ? `#${matchId.toString()}` : "—"}</div>

          {m && (
            <div className="muted tiny mt-2">
              P1: {shortAddr(p1)} • P2:{" "}
              {p2 && p2 !== "0x0000000000000000000000000000000000000000"
                ? shortAddr(p2)
                : "—"}
              <br />
              STATUS:{" "}
              {mStatus === 1
                ? "QUEUED"
                : mStatus === 2
                ? "REVEAL"
                : mStatus === 3
                ? "FINALIZED"
                : mStatus === 4
                ? "CANCELLED"
                : "—"}
              <br />
              REVEALS: {revealed1 ? "P1✅" : "P1—"} / {revealed2 ? "P2✅" : "P2—"}
              <br />
              YOUR MOVE: {myChoice ? choiceLabel(myChoice) : "—"}
            </div>
          )}
        </div>

        {/* Two main buttons area */}
        <div className="mt-4">
          <div className="muted tiny">BET SIZE</div>
          <select
            className="input mt-1"
            value={betIndex === null ? "" : String(betIndex)}
            onChange={(e) => setBetIndex(e.target.value === "" ? null : Number(e.target.value))}
            disabled={!isConnected || wrongNetwork || isPending}
          >
            <option value="">CHOOSE…</option>
            {BET_LABELS.map((lbl, i) => (
              <option key={i} value={i}>
                {lbl}
              </option>
            ))}
          </select>

          <div className="mt-3 flex gap-2">
            <button
              className="btn btnMint flex-1"
              onClick={approve}
              disabled={!isConnected || wrongNetwork || isPending || betIndex === null || !needsApproval}
            >
              APPROVE USDC
            </button>

            <button
              className="btn btnGold flex-1"
              onClick={startPlay}
              disabled={!isConnected || wrongNetwork || isPending || betIndex === null || needsApproval}
            >
              PLAY
            </button>
          </div>

          {betIndex !== null && (
            <div className="muted tiny mt-2">
              Bet: {formatUnits(betAmount, USDC_DECIMALS)} USDC
            </div>
          )}
        </div>

        {/* Move picker */}
        {step === "pick" && (
          <div className="mt-4 inset statBox">
            <div className="muted tiny">PICK YOUR MOVE (COMMIT)</div>
            <div className="mt-3 flex gap-2">
              <button className="btn btnBlue flex-1" onClick={() => commitMove(1)} disabled={isPending || wrongNetwork}>
                ROCK
              </button>
              <button className="btn btnBlue flex-1" onClick={() => commitMove(2)} disabled={isPending || wrongNetwork}>
                PAPER
              </button>
              <button className="btn btnBlue flex-1" onClick={() => commitMove(3)} disabled={isPending || wrongNetwork}>
                SCISSORS
              </button>
            </div>

            <div className="muted tiny mt-3">
              Your move is committed privately. Reveal after you’re matched.
            </div>
          </div>
        )}

        {/* Reveal / Cancel / Timeout */}
        <div className="mt-4 flex gap-2">
          <button className="btn btnGold flex-1" onClick={reveal} disabled={!matchId || wrongNetwork || isPending || mStatus !== 2}>
            REVEAL
          </button>
          <button className="btn btnMint flex-1" onClick={cancel} disabled={!matchId || wrongNetwork || isPending || mStatus !== 1}>
            CANCEL (IF QUEUED)
          </button>
        </div>

        <div className="mt-3">
          <button className="btn btnBlue w-full" onClick={claimTimeout} disabled={!matchId || wrongNetwork || isPending || mStatus !== 2}>
            CLAIM TIMEOUT (IF OPPONENT DIDN’T REVEAL)
          </button>
        </div>
      </div>
    </main>
  );
}
