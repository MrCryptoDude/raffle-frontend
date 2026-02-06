"use client";

import * as React from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { useGovernanceProposals } from "@/app/hooks/useGovernanceProposals";

type ListMode = "active" | "passed" | "all";

const STATE_COLORS: Record<number, string> = {
  0: "rgba(255,200,100,0.9)", // Pending - yellow
  1: "rgba(100,255,150,0.9)", // Active - green
  2: "rgba(255,100,100,0.9)", // Canceled - red
  3: "rgba(255,100,100,0.9)", // Defeated - red
  4: "rgba(100,200,255,0.9)", // Succeeded - blue
  5: "rgba(180,150,255,0.9)", // Queued - purple
  6: "rgba(150,150,150,0.9)", // Expired - gray
  7: "rgba(100,255,150,0.9)", // Executed - green
};

const STATE_LABELS: Record<number, string> = {
  0: "⏳ Pending",
  1: "🗳️ Active",
  2: "❌ Canceled",
  3: "👎 Defeated",
  4: "✅ Succeeded",
  5: "📋 Queued",
  6: "⏰ Expired",
  7: "🎉 Executed",
};

function stateLabel(state?: number) {
  if (state === undefined) return "Loading...";
  return STATE_LABELS[state] ?? `Unknown (${state})`;
}

function stateColor(state?: number) {
  if (state === undefined) return "rgba(255,255,255,0.5)";
  return STATE_COLORS[state] ?? "rgba(255,255,255,0.5)";
}

function fmtVotes(x?: bigint) {
  if (x === undefined) return "—";
  const num = Number(formatUnits(x, 18));
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toFixed(2);
}

function matchesMode(state: number | undefined, mode: ListMode) {
  if (mode === "all") return true;
  if (state === undefined) return true;
  if (mode === "active") return state === 0 || state === 1;
  if (mode === "passed") return state === 4 || state === 5 || state === 7;
  return true;
}

export default function GovernancePage() {
  const { address, isConnected } = useAccount();
  const governor = addresses.governor;

  const { data, loading, error } = useGovernanceProposals({ fromBlock: 0n, limit: 200 });

  const [selectedId, setSelectedId] = React.useState<bigint | null>(null);
  const [mode, setMode] = React.useState<ListMode>("active");
  const [stateCache, setStateCache] = React.useState<Record<string, number>>({});

  // Default selection
  React.useEffect(() => {
    if (!selectedId && data.length > 0) setSelectedId(data[0].proposalId);
  }, [data, selectedId]);

  const selected = React.useMemo(() => {
    if (!selectedId) return data[0] ?? null;
    return data.find((p) => p.proposalId === selectedId) ?? (data[0] ?? null);
  }, [data, selectedId]);

  // Prefetch states
  function StatePrefetch({ proposalId }: { proposalId: bigint }) {
    const st = useReadContract({
      address: governor,
      abi: governorAbi,
      functionName: "state",
      args: [proposalId],
      query: { enabled: !!governor },
    });

    React.useEffect(() => {
      const v = st.data as unknown as number | undefined;
      if (v === undefined) return;
      setStateCache((prev) => {
        const k = proposalId.toString();
        if (prev[k] === v) return prev;
        return { ...prev, [k]: v };
      });
    }, [st.data, proposalId]);

    return null;
  }

  const filtered = React.useMemo(() => {
    return data.filter((p) => matchesMode(stateCache[p.proposalId.toString()], mode));
  }, [data, mode, stateCache]);

  // Selected proposal data
  const selectedState = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "state",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected, refetchInterval: 10000 },
  });

  const selectedVotes = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "proposalVotes",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected, refetchInterval: 10000 },
  });

  const selectedDeadline = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "proposalDeadline",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected },
  });

  const stNum = selectedState.data as unknown as number | undefined;
  const votes = selectedVotes.data as unknown as
    | { againstVotes: bigint; forVotes: bigint; abstainVotes: bigint }
    | undefined;
  const deadline = selectedDeadline.data as unknown as bigint | undefined;

  // Voting
  const { writeContract, data: voteTxHash, isPending: voteIsPending } = useWriteContract();
  const voteReceipt = useWaitForTransactionReceipt({ hash: voteTxHash, query: { enabled: !!voteTxHash } });

  const [voteSuccess, setVoteSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (voteReceipt.isSuccess) {
      setVoteSuccess("Vote submitted successfully! 🎉");
      setTimeout(() => setVoteSuccess(null), 5000);
    }
  }, [voteReceipt.isSuccess]);

  function castVote(support: number) {
    if (!selected || !governor) return;
    writeContract({
      address: governor,
      abi: governorAbi,
      functionName: "castVote",
      args: [selected.proposalId, support],
    });
  }

  // Queue & Execute
  const { writeContract: writeQueue, data: queueTxHash, isPending: queueIsPending } = useWriteContract();
  const { writeContract: writeExecute, data: executeTxHash, isPending: executeIsPending } = useWriteContract();

  const canVote = stNum === 1 && isConnected;
  const canQueue = stNum === 4 && isConnected;
  const canExecute = stNum === 5 && isConnected;

  // Calculate vote percentages
  const totalVotes = votes ? votes.forVotes + votes.againstVotes + votes.abstainVotes : 0n;
  const forPct = totalVotes > 0n ? Number((votes!.forVotes * 100n) / totalVotes) : 0;
  const againstPct = totalVotes > 0n ? Number((votes!.againstVotes * 100n) / totalVotes) : 0;

  return (
    <main className="screen">
      {/* Header */}
      <section style={{
        padding: "32px 24px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 16,
        border: "1px solid rgba(0,255,140,0.15)",
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgba(0,255,140,0.95)" }}>
          🏛️ GOVERNANCE
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Vote on proposals to shape the future of BRRR Protocol
        </p>
        <Link href="/governance/create" style={{
          display: "inline-block",
          marginTop: 16,
          padding: "12px 24px",
          borderRadius: 10,
          background: "rgba(0,255,140,0.15)",
          border: "1px solid rgba(0,255,140,0.4)",
          color: "rgba(0,255,140,0.95)",
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
        }}>
          + CREATE PROPOSAL
        </Link>
      </section>

      {/* Main Content */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, marginTop: 20 }}>
        {/* Left - Proposal List */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(0,255,140,0.15)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
            Proposals
          </h2>

          {/* Filter Tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {[
              { key: "active", label: "Active" },
              { key: "passed", label: "Passed" },
              { key: "all", label: "All" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key as ListMode)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: mode === tab.key ? "rgba(0,255,140,0.5)" : "rgba(255,255,255,0.1)",
                  background: mode === tab.key ? "rgba(0,255,140,0.15)" : "transparent",
                  color: mode === tab.key ? "rgba(0,255,140,0.95)" : "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Proposal List */}
          <div style={{ marginTop: 16, maxHeight: 500, overflowY: "auto" }}>
            {loading && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Loading proposals...</p>}
            {error && <p style={{ color: "rgba(255,100,100,0.9)", fontSize: 13 }}>{error}</p>}
            {!loading && filtered.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>No proposals found</p>
            )}

            {data.slice(0, 50).map((p) => (
              <StatePrefetch key={`prefetch-${p.proposalId.toString()}`} proposalId={p.proposalId} />
            ))}

            {filtered.map((p) => {
              const pState = stateCache[p.proposalId.toString()];
              const isSelected = selected?.proposalId === p.proposalId;

              return (
                <button
                  key={p.proposalId.toString()}
                  onClick={() => setSelectedId(p.proposalId)}
                  style={{
                    width: "100%",
                    padding: 14,
                    marginBottom: 8,
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: isSelected ? "rgba(0,255,140,0.5)" : "rgba(255,255,255,0.1)",
                    background: isSelected ? "rgba(0,255,140,0.1)" : "rgba(0,0,0,0.2)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                      #{p.proposalId.toString().slice(0, 8)}...
                    </span>
                    <span style={{ fontSize: 11, color: stateColor(pState), fontWeight: 600 }}>
                      {stateLabel(pState)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    marginTop: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {p.title || "Untitled Proposal"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right - Proposal Details & Voting */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(0,255,140,0.15)",
          padding: 24,
        }}>
          {selected ? (
            <>
              {/* Status Badge */}
              <div style={{
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: 20,
                background: `${stateColor(stNum)}20`,
                border: `1px solid ${stateColor(stNum)}40`,
                color: stateColor(stNum),
                fontSize: 13,
                fontWeight: 700,
              }}>
                {stateLabel(stNum)}
              </div>

              {/* Title */}
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.95)", marginTop: 16 }}>
                {selected.title || "Untitled Proposal"}
              </h2>

              {/* Proposer */}
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                Proposed by: <span style={{ fontFamily: "monospace" }}>{selected.proposer?.slice(0, 10)}...{selected.proposer?.slice(-8)}</span>
              </p>

              {/* Description */}
              <div style={{
                marginTop: 20,
                padding: 16,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>
                  📝 Description
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {selected.description || "No description provided."}
                </p>
              </div>

              {/* Voting Section */}
              <div style={{
                marginTop: 20,
                padding: 20,
                background: "rgba(0,255,140,0.05)",
                borderRadius: 12,
                border: "1px solid rgba(0,255,140,0.2)",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "rgba(0,255,140,0.95)", marginBottom: 16 }}>
                  🗳️ Cast Your Vote
                </h3>

                {/* Vote Buttons */}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => castVote(1)}
                    disabled={!canVote || voteIsPending}
                    style={{
                      flex: 1,
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: "2px solid rgba(100,255,150,0.5)",
                      background: "rgba(100,255,150,0.15)",
                      color: "rgba(100,255,150,0.95)",
                      fontSize: 16,
                      fontWeight: 800,
                      cursor: canVote ? "pointer" : "not-allowed",
                      opacity: canVote ? 1 : 0.5,
                    }}
                  >
                    👍 FOR
                  </button>
                  <button
                    onClick={() => castVote(0)}
                    disabled={!canVote || voteIsPending}
                    style={{
                      flex: 1,
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: "2px solid rgba(255,100,100,0.5)",
                      background: "rgba(255,100,100,0.15)",
                      color: "rgba(255,100,100,0.95)",
                      fontSize: 16,
                      fontWeight: 800,
                      cursor: canVote ? "pointer" : "not-allowed",
                      opacity: canVote ? 1 : 0.5,
                    }}
                  >
                    👎 AGAINST
                  </button>
                  <button
                    onClick={() => castVote(2)}
                    disabled={!canVote || voteIsPending}
                    style={{
                      flex: 1,
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: "2px solid rgba(150,150,150,0.5)",
                      background: "rgba(150,150,150,0.15)",
                      color: "rgba(200,200,200,0.95)",
                      fontSize: 16,
                      fontWeight: 800,
                      cursor: canVote ? "pointer" : "not-allowed",
                      opacity: canVote ? 1 : 0.5,
                    }}
                  >
                    🤷 ABSTAIN
                  </button>
                </div>

                {!isConnected && (
                  <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,200,100,0.9)" }}>
                    ⚠️ Connect your wallet to vote
                  </p>
                )}
                {stNum !== 1 && isConnected && (
                  <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                    Voting is only available when the proposal is Active
                  </p>
                )}
                {voteIsPending && (
                  <p style={{ marginTop: 12, fontSize: 13, color: "rgba(100,200,255,0.9)" }}>
                    ⏳ Submitting your vote...
                  </p>
                )}
                {voteSuccess && (
                  <p style={{ marginTop: 12, fontSize: 13, color: "rgba(100,255,150,0.9)" }}>
                    {voteSuccess}
                  </p>
                )}
              </div>

              {/* Vote Results */}
              <div style={{
                marginTop: 20,
                padding: 20,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
                  📊 Current Results
                </h3>

                {/* Progress Bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: "flex",
                    height: 12,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.1)",
                  }}>
                    <div style={{
                      width: `${forPct}%`,
                      background: "rgba(100,255,150,0.8)",
                      transition: "width 0.3s",
                    }} />
                    <div style={{
                      width: `${againstPct}%`,
                      background: "rgba(255,100,100,0.8)",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>FOR</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "rgba(100,255,150,0.95)" }}>
                      {fmtVotes(votes?.forVotes)}
                    </p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>AGAINST</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,100,100,0.95)" }}>
                      {fmtVotes(votes?.againstVotes)}
                    </p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>ABSTAIN</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "rgba(200,200,200,0.95)" }}>
                      {fmtVotes(votes?.abstainVotes)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Queue/Execute Actions */}
              {(canQueue || canExecute) && (
                <div style={{ marginTop: 20 }}>
                  {canQueue && (
                    <button
                      onClick={() => {
                        // Queue requires the full proposal data
                        // For now just show a message
                        alert("Queue functionality requires proposal targets/values/calldatas. Coming soon!");
                      }}
                      disabled={queueIsPending}
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        borderRadius: 12,
                        border: "2px solid rgba(180,150,255,0.5)",
                        background: "rgba(180,150,255,0.15)",
                        color: "rgba(180,150,255,0.95)",
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      📋 QUEUE PROPOSAL
                    </button>
                  )}
                  {canExecute && (
                    <button
                      onClick={() => {
                        alert("Execute functionality requires proposal targets/values/calldatas. Coming soon!");
                      }}
                      disabled={executeIsPending}
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        borderRadius: 12,
                        border: "2px solid rgba(100,255,150,0.5)",
                        background: "rgba(100,255,150,0.15)",
                        color: "rgba(100,255,150,0.95)",
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      🚀 EXECUTE PROPOSAL
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }}>
                Select a proposal to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Responsive */}
      <style jsx>{`
        @media (max-width: 820px) {
          div[style*="grid-template-columns: 300px 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
