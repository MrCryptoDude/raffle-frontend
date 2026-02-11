"use client";

import * as React from "react";
import Link from "next/link";
import { formatUnits, isAddress } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { useGovernanceProposals } from "@/app/hooks/useGovernanceProposals";

type ListMode = "active" | "passed" | "all";
type ProposalCategory = "raffle" | "lp" | "signal" | "other";

// BRRR token ABI for delegation
const brrrAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getVotes",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "delegates",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "delegate",
    stateMutability: "nonpayable",
    inputs: [{ name: "delegatee", type: "address" }],
    outputs: [],
  },
] as const;

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

const CATEGORY_CONFIG: Record<ProposalCategory, { icon: string; label: string; color: string }> = {
  raffle: { icon: "🎰", label: "Raffle", color: "rgba(255,200,100,0.9)" },
  lp: { icon: "💰", label: "LP", color: "rgba(100,200,255,0.9)" },
  signal: { icon: "📢", label: "Signal", color: "rgba(180,150,255,0.9)" },
  other: { icon: "⚙️", label: "Other", color: "rgba(150,150,150,0.9)" },
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

function fmtAddress(addr?: string) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "None";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function matchesMode(state: number | undefined, mode: ListMode) {
  if (mode === "all") return true;
  if (state === undefined) return true;
  if (mode === "active") return state === 0 || state === 1;
  if (mode === "passed") return state === 4 || state === 5 || state === 7;
  return true;
}

// Detect proposal category from description and targets
function detectCategory(description?: string, targets?: string[]): ProposalCategory {
  if (!description) return "other";
  
  const descLower = description.toLowerCase();
  
  // Check for signal proposals
  if (descLower.includes("[signal]") || descLower.includes("signal proposal")) {
    return "signal";
  }
  
  // Check for raffle-related content
  if (
    descLower.includes("raffle") ||
    descLower.includes("forcereset") ||
    (targets && targets.some((t) => t.toLowerCase() === addresses.manager?.toLowerCase()))
  ) {
    return "raffle";
  }
  
  // Check for LP-related content
  if (
    descLower.includes("liquidity") ||
    descLower.includes("lp position") ||
    descLower.includes("collect fees") ||
    descLower.includes("community lp")
  ) {
    return "lp";
  }
  
  return "other";
}

// Delegation Component
function DelegationPanel() {
  const { address, isConnected } = useAccount();
  const brrr = addresses.raffle; // BRRR token address

  const [customDelegate, setCustomDelegate] = React.useState("");
  const [showCustom, setShowCustom] = React.useState(false);

  // Read BRRR balance
  const { data: balance } = useReadContract({
    address: brrr,
    abi: brrrAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!brrr && !!address, refetchInterval: 10000 },
  });

  // Read voting power
  const { data: votingPower } = useReadContract({
    address: brrr,
    abi: brrrAbi,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!brrr && !!address, refetchInterval: 10000 },
  });

  // Read current delegate
  const { data: currentDelegate } = useReadContract({
    address: brrr,
    abi: brrrAbi,
    functionName: "delegates",
    args: address ? [address] : undefined,
    query: { enabled: !!brrr && !!address, refetchInterval: 10000 },
  });

  // Delegate transaction
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (receipt.isSuccess) {
      setSuccessMsg("Delegation updated! 🎉");
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  }, [receipt.isSuccess]);

  function delegateToSelf() {
    if (!brrr || !address) return;
    writeContract({
      address: brrr,
      abi: brrrAbi,
      functionName: "delegate",
      args: [address],
    });
  }

  function delegateToCustom() {
    if (!brrr || !isAddress(customDelegate)) return;
    writeContract({
      address: brrr,
      abi: brrrAbi,
      functionName: "delegate",
      args: [customDelegate as `0x${string}`],
    });
  }

  function undelegate() {
    if (!brrr) return;
    writeContract({
      address: brrr,
      abi: brrrAbi,
      functionName: "delegate",
      args: ["0x0000000000000000000000000000000000000000"],
    });
  }

  const isDelegatedToSelf = currentDelegate?.toLowerCase() === address?.toLowerCase();
  const isNotDelegated = !currentDelegate || currentDelegate === "0x0000000000000000000000000000000000000000";
  const needsDelegation = (balance ?? 0n) > 0n && isNotDelegated;

  if (!isConnected) {
    return (
      <div style={{
        padding: 16,
        background: "rgba(255,200,100,0.1)",
        borderRadius: 12,
        border: "1px solid rgba(255,200,100,0.3)",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "rgba(255,200,100,0.9)" }}>
          ⚠️ Connect your wallet to vote and create proposals
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: 20,
      background: "rgba(0,0,0,0.3)",
      borderRadius: 16,
      border: needsDelegation ? "1px solid rgba(255,200,100,0.5)" : "1px solid rgba(0,255,140,0.15)",
    }}>
      {/* Warning if not delegated */}
      {needsDelegation && (
        <div style={{
          padding: 12,
          background: "rgba(255,200,100,0.15)",
          borderRadius: 10,
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, color: "rgba(255,200,100,0.95)", fontWeight: 600 }}>
            ⚠️ Delegate your BRRR to vote!
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
            You have BRRR but no voting power. Delegate to yourself to activate.
          </p>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>BRRR BALANCE</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
            {fmtVotes(balance as bigint | undefined)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>VOTING POWER</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: (votingPower ?? 0n) > 0n ? "rgba(0,255,140,0.95)" : "rgba(255,100,100,0.9)" }}>
            {fmtVotes(votingPower as bigint | undefined)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>DELEGATED TO</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>
            {isDelegatedToSelf ? "Yourself ✓" : fmtAddress(currentDelegate as string | undefined)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Delegate to Self */}
        {!isDelegatedToSelf && (
          <button
            onClick={delegateToSelf}
            disabled={isPending || (balance ?? 0n) === 0n}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(0,255,140,0.5)",
              background: "rgba(0,255,140,0.15)",
              color: "rgba(0,255,140,0.95)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isPending || (balance ?? 0n) === 0n ? "not-allowed" : "pointer",
              opacity: isPending || (balance ?? 0n) === 0n ? 0.5 : 1,
            }}
          >
            {isPending ? "⏳ Delegating..." : "✋ Delegate to Myself"}
          </button>
        )}

        {/* Undelegate */}
        {!isNotDelegated && (
          <button
            onClick={undelegate}
            disabled={isPending}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,100,100,0.4)",
              background: "rgba(255,100,100,0.1)",
              color: "rgba(255,100,100,0.9)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.5 : 1,
            }}
          >
            ✖ Undelegate
          </button>
        )}

        {/* Delegate to Other */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(100,200,255,0.4)",
            background: "rgba(100,200,255,0.1)",
            color: "rgba(100,200,255,0.9)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {showCustom ? "✖ Cancel" : "👥 Delegate to Other"}
        </button>
      </div>

      {/* Custom Delegate Input */}
      {showCustom && (
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <input
            type="text"
            value={customDelegate}
            onChange={(e) => setCustomDelegate(e.target.value)}
            placeholder="0x... delegate address"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(255,255,255,0.9)",
              fontSize: 13,
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={delegateToCustom}
            disabled={isPending || !isAddress(customDelegate)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid rgba(100,200,255,0.5)",
              background: "rgba(100,200,255,0.2)",
              color: "rgba(100,200,255,0.95)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isPending || !isAddress(customDelegate) ? "not-allowed" : "pointer",
              opacity: isPending || !isAddress(customDelegate) ? 0.5 : 1,
            }}
          >
            Delegate
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <p style={{ marginTop: 12, fontSize: 13, color: "rgba(100,255,150,0.9)" }}>
          {successMsg}
        </p>
      )}
    </div>
  );
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
    return data.filter((p) => {
      if (!p || !p.proposalId) return false;
      return matchesMode(stateCache[p.proposalId.toString()], mode);
    });
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
  
  // proposalVotes returns [againstVotes, forVotes, abstainVotes] as array
  const rawVotes = selectedVotes.data as unknown as [bigint, bigint, bigint] | undefined;
  const votes = rawVotes ? {
    againstVotes: rawVotes[0],
    forVotes: rawVotes[1],
    abstainVotes: rawVotes[2],
  } : undefined;
  
  const deadline = selectedDeadline.data as unknown as bigint | undefined;
  
  // Debug logging
  React.useEffect(() => {
    if (selectedVotes.data) {
      console.log('[Governance] Raw votes data:', selectedVotes.data);
      console.log('[Governance] Parsed votes:', votes);
    }
  }, [selectedVotes.data, votes]);

  // Get category for selected proposal
  const selectedCategory = React.useMemo(() => {
    if (!selected) return "other";
    return detectCategory(selected.description, selected.targets);
  }, [selected]);

  const categoryConfig = CATEGORY_CONFIG[selectedCategory];

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

      {/* Delegation Panel */}
      <div style={{ marginTop: 20 }}>
        <DelegationPanel />
      </div>

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
            {error && (
              <div style={{ padding: 12, background: "rgba(255,100,100,0.1)", borderRadius: 8, marginBottom: 8 }}>
                <p style={{ color: "rgba(255,100,100,0.9)", fontSize: 12 }}>{error}</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>Make sure you&apos;re connected to Base Sepolia</p>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: 20 }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>No proposals yet</p>
                <Link href="/governance/create" style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(0,255,140,0.1)",
                  border: "1px solid rgba(0,255,140,0.3)",
                  color: "rgba(0,255,140,0.9)",
                  fontSize: 12,
                  textDecoration: "none",
                }}>
                  Create the first one!
                </Link>
              </div>
            )}

            {data.slice(0, 50).map((p) => (
              <StatePrefetch key={`prefetch-${p.proposalId.toString()}`} proposalId={p.proposalId} />
            ))}

            {filtered.map((p) => {
              const pState = stateCache[p.proposalId.toString()];
              const isSelected = selected?.proposalId === p.proposalId;
              const category = detectCategory(p.description, p.targets);
              const catConfig = CATEGORY_CONFIG[category];

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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    {/* Category Tag */}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 12,
                      background: `${catConfig.color}20`,
                      color: catConfig.color,
                    }}>
                      {catConfig.icon} {catConfig.label}
                    </span>
                    {/* State */}
                    <span style={{ fontSize: 10, color: stateColor(pState), fontWeight: 600 }}>
                      {stateLabel(pState)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {p.title || "Untitled Proposal"}
                  </p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                    #{p.proposalId.toString().slice(0, 8)}...
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
              {/* Category & Status Badges */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {/* Category Badge */}
                <div style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 20,
                  background: `${categoryConfig.color}15`,
                  border: `1px solid ${categoryConfig.color}40`,
                  color: categoryConfig.color,
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {categoryConfig.icon} {categoryConfig.label}
                </div>

                {/* Status Badge */}
                <div style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 20,
                  background: `${stateColor(stNum)}20`,
                  border: `1px solid ${stateColor(stNum)}40`,
                  color: stateColor(stNum),
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {stateLabel(stNum)}
                </div>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.95)", marginTop: 8 }}>
                {selected.title || "Untitled Proposal"}
              </h2>

              {/* Proposer */}
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                Proposed by: <span style={{ fontFamily: "monospace" }}>{selected.proposer?.slice(0, 10)}...{selected.proposer?.slice(-8)}</span>
              </p>

              {/* Signal Notice */}
              {selectedCategory === "signal" && (
                <div style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  background: "rgba(180,150,255,0.1)",
                  border: "1px solid rgba(180,150,255,0.3)",
                }}>
                  <p style={{ fontSize: 13, color: "rgba(180,150,255,0.9)" }}>
                    📢 <strong>Signal Proposal</strong> — This is a discussion vote. No on-chain actions will be executed.
                  </p>
                </div>
              )}

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
