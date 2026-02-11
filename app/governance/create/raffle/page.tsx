"use client";

import * as React from "react";
import Link from "next/link";
import { keccak256, toBytes, encodeFunctionData, isAddress } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

// RaffleManager ABI (only the functions DAO can call)
const raffleManagerAbi = [
  {
    name: "forceReset",
    type: "function",
    inputs: [{ name: "rTypeU8", type: "uint8" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "forceResetRound",
    type: "function",
    inputs: [
      { name: "rTypeU8", type: "uint8" },
      { name: "roundId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "setAutomationForwarder",
    type: "function",
    inputs: [{ name: "forwarder", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "setRNG",
    type: "function",
    inputs: [{ name: "rng_", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const RAFFLE_TYPES = [
  { value: 0, label: "Small", pot: "$1,000", tickets: "100" },
  { value: 1, label: "Medium", pot: "$10,000", tickets: "1,000" },
  { value: 2, label: "Large", pot: "$100,000", tickets: "10,000" },
  { value: 3, label: "Mega", pot: "$1,000,000", tickets: "100,000" },
];

const ACTIONS = [
  {
    id: "forceReset",
    label: "Reset Current Round",
    description: "Cancel the current round and refund all participants. Opens a new round automatically.",
    icon: "🔄",
    fields: ["raffleType"],
  },
  {
    id: "forceResetRound",
    label: "Reset Specific Round",
    description: "Cancel a specific stuck round by ID. Use this for rounds that failed to settle.",
    icon: "🎯",
    fields: ["raffleType", "roundId"],
  },
  {
    id: "setAutomationForwarder",
    label: "Update Chainlink Forwarder",
    description: "Change the Chainlink Automation forwarder address.",
    icon: "🔗",
    fields: ["address"],
  },
  {
    id: "setRNG",
    label: "Update VRF Adapter",
    description: "Change the Chainlink VRF random number generator address.",
    icon: "🎲",
    fields: ["address"],
  },
];

export default function RaffleProposalPage() {
  const { isConnected } = useAccount();
  const governor = addresses.governor;
  const raffleManager = addresses.manager;

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedAction, setSelectedAction] = React.useState<string>("forceReset");
  const [raffleType, setRaffleType] = React.useState<number>(0);
  const [roundId, setRoundId] = React.useState("");
  const [addressInput, setAddressInput] = React.useState("");

  // Auto-generate title based on action
  React.useEffect(() => {
    const action = ACTIONS.find((a) => a.id === selectedAction);
    if (!action) return;

    if (selectedAction === "forceReset") {
      const rType = RAFFLE_TYPES.find((r) => r.value === raffleType);
      setTitle(`Reset ${rType?.label} Raffle - Current Round`);
    } else if (selectedAction === "forceResetRound") {
      const rType = RAFFLE_TYPES.find((r) => r.value === raffleType);
      setTitle(`Reset ${rType?.label} Raffle - Round #${roundId || "?"}`);
    } else if (selectedAction === "setAutomationForwarder") {
      setTitle("Update RaffleManager Chainlink Forwarder");
    } else if (selectedAction === "setRNG") {
      setTitle("Update RaffleManager VRF Adapter");
    }
  }, [selectedAction, raffleType, roundId]);

  // Build proposal
  const buildResult = React.useMemo(() => {
    const errors: string[] = [];

    if (!title.trim()) errors.push("Title is required");
    if (!description.trim()) errors.push("Description is required");
    if (!raffleManager) errors.push("RaffleManager address not configured");

    let calldata: `0x${string}` = "0x";

    try {
      if (selectedAction === "forceReset") {
        calldata = encodeFunctionData({
          abi: raffleManagerAbi,
          functionName: "forceReset",
          args: [raffleType],
        });
      } else if (selectedAction === "forceResetRound") {
        if (!roundId || isNaN(Number(roundId))) {
          errors.push("Valid round ID is required");
        } else {
          calldata = encodeFunctionData({
            abi: raffleManagerAbi,
            functionName: "forceResetRound",
            args: [raffleType, BigInt(roundId)],
          });
        }
      } else if (selectedAction === "setAutomationForwarder") {
        if (!isAddress(addressInput)) {
          errors.push("Valid forwarder address is required");
        } else {
          calldata = encodeFunctionData({
            abi: raffleManagerAbi,
            functionName: "setAutomationForwarder",
            args: [addressInput as `0x${string}`],
          });
        }
      } else if (selectedAction === "setRNG") {
        if (!isAddress(addressInput)) {
          errors.push("Valid RNG address is required");
        } else {
          calldata = encodeFunctionData({
            abi: raffleManagerAbi,
            functionName: "setRNG",
            args: [addressInput as `0x${string}`],
          });
        }
      }
    } catch (e: any) {
      errors.push(`Encoding error: ${e?.message || "Unknown"}`);
    }

    if (errors.length > 0) {
      return { errors, targets: [], values: [], calldatas: [], fullDescription: "" };
    }

    const fullDescription = `${title}\n\n${description}`;

    return {
      errors: [],
      targets: [raffleManager as `0x${string}`],
      values: [0n],
      calldatas: [calldata],
      fullDescription,
    };
  }, [title, description, selectedAction, raffleType, roundId, addressInput, raffleManager]);

  // Submit
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  function submitProposal() {
    if (!governor || buildResult.errors.length > 0) return;

    writeContract({
      address: governor,
      abi: governorAbi,
      functionName: "propose",
      args: [buildResult.targets, buildResult.values, buildResult.calldatas, buildResult.fullDescription],
    });
  }

  const canSubmit = isConnected && buildResult.errors.length === 0 && !isPending;
  const currentAction = ACTIONS.find((a) => a.id === selectedAction);

  return (
    <main className="screen">
      {/* Header */}
      <section style={{
        padding: "32px 24px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 16,
        border: "1px solid rgba(255,200,100,0.3)",
        textAlign: "center",
      }}>
        <Link href="/governance/create" style={{ fontSize: 13, color: "rgba(255,200,100,0.7)", textDecoration: "none" }}>
          ← Back to Categories
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgba(255,200,100,0.95)", marginTop: 16 }}>
          🎰 RAFFLE MANAGER
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Create a proposal to manage stuck or problematic raffles
        </p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, marginTop: 20 }}>
        {/* Left - Form */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(255,200,100,0.15)",
          padding: 24,
        }}>
          {/* Step 1: Select Action */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              1️⃣ Select Action
            </h2>

            <div style={{ display: "grid", gap: 10 }}>
              {ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setSelectedAction(action.id)}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    border: "1px solid",
                    borderColor: selectedAction === action.id ? "rgba(255,200,100,0.5)" : "rgba(255,255,255,0.1)",
                    background: selectedAction === action.id ? "rgba(255,200,100,0.1)" : "rgba(0,0,0,0.2)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{action.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                        {action.label}
                      </p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                        {action.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Parameters */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              2️⃣ Parameters
            </h2>

            {/* Raffle Type Selector */}
            {currentAction?.fields.includes("raffleType") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
                  Raffle Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {RAFFLE_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => setRaffleType(rt.value)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 10,
                        border: "1px solid",
                        borderColor: raffleType === rt.value ? "rgba(255,200,100,0.5)" : "rgba(255,255,255,0.1)",
                        background: raffleType === rt.value ? "rgba(255,200,100,0.1)" : "rgba(0,0,0,0.2)",
                        textAlign: "center",
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                        {rt.label}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                        {rt.pot} pot • {rt.tickets} tickets
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Round ID Input */}
            {currentAction?.fields.includes("roundId") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  Round ID
                </label>
                <input
                  type="number"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                  placeholder="e.g., 5"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.3)",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 15,
                  }}
                />
              </div>
            )}

            {/* Address Input */}
            {currentAction?.fields.includes("address") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  {selectedAction === "setAutomationForwarder" ? "Forwarder Address" : "RNG Address"}
                </label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="0x..."
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.3)",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 14,
                    fontFamily: "monospace",
                  }}
                />
              </div>
            )}
          </div>

          {/* Step 3: Description */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              3️⃣ Justification
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                Title (auto-generated, editable)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.3)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 15,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                Why is this action needed? *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the problem and why this action is necessary..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.3)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>
          </div>
        </div>

        {/* Right - Preview & Submit */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(255,200,100,0.15)",
          padding: 24,
          height: "fit-content",
          position: "sticky",
          top: 100,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 20 }}>
            📋 Proposal Preview
          </h2>

          {/* Type Badge */}
          <div style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 20,
            background: "rgba(255,200,100,0.15)",
            border: "1px solid rgba(255,200,100,0.3)",
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,200,100,0.95)" }}>
              🎰 Raffle Manager
            </span>
          </div>

          {/* Preview Card */}
          <div style={{
            padding: 16,
            borderRadius: 12,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 20,
          }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TITLE</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                {title || "—"}
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ACTION</p>
              <p style={{ fontSize: 13, color: "rgba(255,200,100,0.9)", fontWeight: 600 }}>
                {currentAction?.icon} {currentAction?.label}
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TARGET</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
                RaffleManager
              </p>
            </div>

            {currentAction?.fields.includes("raffleType") && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>RAFFLE TYPE</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                  {RAFFLE_TYPES.find((r) => r.value === raffleType)?.label}
                </p>
              </div>
            )}

            {currentAction?.fields.includes("roundId") && roundId && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ROUND ID</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>#{roundId}</p>
              </div>
            )}

            {currentAction?.fields.includes("address") && addressInput && (
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>NEW ADDRESS</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {addressInput}
                </p>
              </div>
            )}
          </div>

          {/* Timelock Notice */}
          <div style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(100,200,255,0.1)",
            border: "1px solid rgba(100,200,255,0.2)",
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 12, color: "rgba(100,200,255,0.9)" }}>
              ⏰ If passed, executes after <strong>24 hour</strong> timelock
            </p>
          </div>

          {/* Errors */}
          {buildResult.errors.length > 0 && (
            <div style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(255,100,100,0.1)",
              border: "1px solid rgba(255,100,100,0.3)",
              marginBottom: 20,
            }}>
              {buildResult.errors.map((err, i) => (
                <p key={i} style={{ fontSize: 12, color: "rgba(255,100,100,0.9)", marginTop: i > 0 ? 4 : 0 }}>
                  • {err}
                </p>
              ))}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={submitProposal}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "18px 24px",
              borderRadius: 12,
              border: "2px solid",
              borderColor: canSubmit ? "rgba(255,200,100,0.5)" : "rgba(100,100,100,0.3)",
              background: canSubmit ? "rgba(255,200,100,0.2)" : "rgba(100,100,100,0.2)",
              color: canSubmit ? "rgba(255,200,100,0.95)" : "rgba(150,150,150,0.8)",
              fontSize: 16,
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {isPending ? "⏳ SUBMITTING..." : "🚀 SUBMIT PROPOSAL"}
          </button>

          {!isConnected && (
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,200,100,0.9)", textAlign: "center" }}>
              ⚠️ Connect wallet to submit
            </p>
          )}

          {/* Transaction Status */}
          {receipt.isSuccess && (
            <div style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              background: "rgba(100,255,150,0.1)",
              border: "1px solid rgba(100,255,150,0.3)",
            }}>
              <p style={{ fontSize: 12, color: "rgba(100,255,150,0.9)" }}>✅ Proposal created!</p>
              <Link href="/governance" style={{ fontSize: 12, color: "rgba(0,255,140,0.8)", marginTop: 8, display: "block" }}>
                → View all proposals
              </Link>
            </div>
          )}

          {writeError && (
            <div style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              background: "rgba(255,100,100,0.1)",
              border: "1px solid rgba(255,100,100,0.3)",
            }}>
              <p style={{ fontSize: 12, color: "rgba(255,100,100,0.9)" }}>
                ❌ {writeError.message?.slice(0, 100)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Responsive */}
      <style jsx>{`
        @media (max-width: 820px) {
          div[style*="grid-template-columns: 1fr 360px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
