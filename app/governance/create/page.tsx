"use client";

import * as React from "react";
import Link from "next/link";
import { keccak256, toBytes, encodeFunctionData, isAddress } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { governorAbi, adminAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

// Governance action categories
const GOVERNANCE_ACTIONS = [
  {
    category: "🚨 Emergency",
    description: "Pause contracts or rescue stuck funds",
    actions: [
      { name: "pause", label: "Pause Contract", description: "Temporarily halt all contract operations", inputs: [] },
      { name: "unpause", label: "Unpause Contract", description: "Resume contract operations", inputs: [] },
      { name: "emergencyWithdraw", label: "Emergency Withdraw", description: "Rescue stuck tokens from contract", inputs: [
        { name: "token", type: "address", placeholder: "Token address (0x...)" },
        { name: "to", type: "address", placeholder: "Recipient address (0x...)" },
        { name: "amount", type: "uint256", placeholder: "Amount in wei" },
      ]},
    ],
  },
  {
    category: "⚙️ Protocol Settings",
    description: "Adjust fees and game parameters",
    actions: [
      { name: "setFeeBps", label: "Set Fee (BPS)", description: "Change protocol fee in basis points (100 = 1%)", inputs: [
        { name: "newFeeBps", type: "uint256", placeholder: "Fee in basis points (e.g., 1000 = 10%)" },
      ]},
      { name: "setMinBet", label: "Set Minimum Bet", description: "Change minimum bet amount", inputs: [
        { name: "newMin", type: "uint256", placeholder: "Minimum bet in wei" },
      ]},
      { name: "setMaxBet", label: "Set Maximum Bet", description: "Change maximum bet amount", inputs: [
        { name: "newMax", type: "uint256", placeholder: "Maximum bet in wei" },
      ]},
      { name: "setBettingWindow", label: "Set Betting Window", description: "Change how many blocks betting is open", inputs: [
        { name: "blocks", type: "uint256", placeholder: "Number of blocks" },
      ]},
    ],
  },
  {
    category: "🔗 Integrations",
    description: "Update oracle and automation connections",
    actions: [
      { name: "setVrfAdapter", label: "Set VRF Adapter", description: "Update Chainlink VRF adapter address", inputs: [
        { name: "adapter", type: "address", placeholder: "New adapter address (0x...)" },
      ]},
      { name: "setAutomationForwarder", label: "Set Automation Forwarder", description: "Update Chainlink Automation forwarder", inputs: [
        { name: "forwarder", type: "address", placeholder: "New forwarder address (0x...)" },
      ]},
      { name: "addUsdcDistributor", label: "Add USDC Distributor", description: "Authorize a new contract to distribute USDC rewards", inputs: [
        { name: "distributor", type: "address", placeholder: "Distributor address (0x...)" },
      ]},
      { name: "removeUsdcDistributor", label: "Remove USDC Distributor", description: "Revoke USDC distribution rights", inputs: [
        { name: "distributor", type: "address", placeholder: "Distributor address (0x...)" },
      ]},
    ],
  },
  {
    category: "👑 Ownership",
    description: "Transfer protocol control",
    actions: [
      { name: "transferOwnership", label: "Transfer Ownership", description: "Initiate ownership transfer to new address", inputs: [
        { name: "newOwner", type: "address", placeholder: "New owner address (0x...)" },
      ]},
      { name: "acceptOwnership", label: "Accept Ownership", description: "Accept pending ownership transfer", inputs: [] },
    ],
  },
];

const CONTRACT_OPTIONS = [
  { label: "Gas Prediction Market", value: addresses.gasMarket },
  { label: "Raffle Manager", value: addresses.manager },
  { label: "RPS Manager", value: addresses.rps },
  { label: "Staking Rewards", value: addresses.staking },
].filter((x) => x.value);

export default function CreateProposalPage() {
  const { isConnected } = useAccount();
  const governor = addresses.governor;

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [targetContract, setTargetContract] = React.useState(CONTRACT_OPTIONS[0]?.value || "");
  const [selectedAction, setSelectedAction] = React.useState<string>("");
  const [actionInputs, setActionInputs] = React.useState<Record<string, string>>({});

  // Get selected action details
  const selectedActionDetails = React.useMemo(() => {
    for (const category of GOVERNANCE_ACTIONS) {
      const action = category.actions.find((a) => a.name === selectedAction);
      if (action) return action;
    }
    return null;
  }, [selectedAction]);

  // Reset inputs when action changes
  React.useEffect(() => {
    setActionInputs({});
  }, [selectedAction]);

  // Build the proposal data
  const buildResult = React.useMemo(() => {
    const errors: string[] = [];

    if (!title.trim()) errors.push("Title is required");
    if (!description.trim()) errors.push("Description is required");
    if (!isAddress(targetContract)) errors.push("Invalid target contract address");
    if (!selectedAction) errors.push("Please select an action");

    if (errors.length > 0) {
      return { errors, targets: [], values: [], calldatas: [], descriptionHash: "0x" as `0x${string}` };
    }

    try {
      const fullDescription = `${title}\n\n${description}`;
      const descriptionHash = keccak256(toBytes(fullDescription));

      // Parse args based on input types
      const inputs = selectedActionDetails?.inputs || [];
      const parsedArgs = inputs.map((input) => {
        const val = actionInputs[input.name] || "";
        if (input.type === "uint256") {
          return BigInt(val || "0");
        }
        return val;
      });

      const calldata = encodeFunctionData({
        abi: adminAbi as any,
        functionName: selectedAction as any,
        args: parsedArgs,
      }) as `0x${string}`;

      return {
        errors: [],
        targets: [targetContract as `0x${string}`],
        values: [0n],
        calldatas: [calldata],
        descriptionHash,
        fullDescription,
      };
    } catch (e: any) {
      return {
        errors: [`Failed to encode: ${e?.message || "Unknown error"}`],
        targets: [],
        values: [],
        calldatas: [],
        descriptionHash: "0x" as `0x${string}`,
      };
    }
  }, [title, description, targetContract, selectedAction, selectedActionDetails, actionInputs]);

  // Submit proposal
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  function submitProposal() {
    if (!governor || buildResult.errors.length > 0) return;

    writeContract({
      address: governor,
      abi: governorAbi,
      functionName: "propose",
      args: [buildResult.targets, buildResult.values, buildResult.calldatas, buildResult.fullDescription!],
    });
  }

  const canSubmit = isConnected && buildResult.errors.length === 0 && !isPending;

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
        <Link href="/governance" style={{ fontSize: 13, color: "rgba(0,255,140,0.7)", textDecoration: "none" }}>
          ← Back to Governance
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgba(0,255,140,0.95)", marginTop: 16 }}>
          📝 CREATE PROPOSAL
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Submit a governance proposal for protocol changes
        </p>
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "rgba(255,200,100,0.1)",
          border: "1px solid rgba(255,200,100,0.3)",
          borderRadius: 10,
          display: "inline-block",
        }}>
          <p style={{ fontSize: 12, color: "rgba(255,200,100,0.9)" }}>
            ⚠️ Governance is for <strong>protocol-level changes only</strong> — not for user actions like claiming rewards or making bets
          </p>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginTop: 20 }}>
        {/* Left - Form */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(0,255,140,0.15)",
          padding: 24,
        }}>
          {/* Step 1: Basic Info */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              1️⃣ Proposal Details
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Emergency: Pause Gas Market due to oracle issue"
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
                Reason / Justification *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain why this change is needed and what problem it solves..."
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

          {/* Step 2: Target Contract */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              2️⃣ Target Contract
            </h2>

            <div style={{ display: "grid", gap: 10 }}>
              {CONTRACT_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setTargetContract(c.value!)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: targetContract === c.value ? "rgba(0,255,140,0.5)" : "rgba(255,255,255,0.1)",
                    background: targetContract === c.value ? "rgba(0,255,140,0.1)" : "rgba(0,0,0,0.2)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                    {c.label}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginTop: 4 }}>
                    {c.value}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Action */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              3️⃣ Select Action
            </h2>

            {GOVERNANCE_ACTIONS.map((category) => (
              <div key={category.category} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  {category.category}
                </h3>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                  {category.description}
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {category.actions.map((action) => (
                    <button
                      key={action.name}
                      onClick={() => setSelectedAction(action.name)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: "1px solid",
                        borderColor: selectedAction === action.name ? "rgba(0,255,140,0.5)" : "rgba(255,255,255,0.1)",
                        background: selectedAction === action.name ? "rgba(0,255,140,0.1)" : "rgba(0,0,0,0.2)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                        {action.label}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                        {action.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Step 4: Action Parameters */}
          {selectedActionDetails && selectedActionDetails.inputs.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
                4️⃣ Action Parameters
              </h2>

              {selectedActionDetails.inputs.map((input) => (
                <div key={input.name} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                    {input.name} <span style={{ color: "rgba(255,255,255,0.4)" }}>({input.type})</span>
                  </label>
                  <input
                    type="text"
                    value={actionInputs[input.name] || ""}
                    onChange={(e) => setActionInputs({ ...actionInputs, [input.name]: e.target.value })}
                    placeholder={input.placeholder}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(0,0,0,0.2)",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 13,
                      fontFamily: input.type === "address" ? "monospace" : "inherit",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right - Preview & Submit */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(0,255,140,0.15)",
          padding: 24,
          height: "fit-content",
          position: "sticky",
          top: 100,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 20 }}>
            📋 Proposal Summary
          </h2>

          {/* Preview Card */}
          <div style={{
            padding: 16,
            borderRadius: 12,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 20,
          }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TITLE</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                {title || "—"}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TARGET</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                {CONTRACT_OPTIONS.find((c) => c.value === targetContract)?.label || "—"}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ACTION</p>
              <p style={{ fontSize: 13, color: "rgba(0,255,140,0.9)", fontWeight: 600 }}>
                {selectedActionDetails?.label || "—"}
              </p>
            </div>

            {selectedActionDetails && selectedActionDetails.inputs.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>PARAMETERS</p>
                {selectedActionDetails.inputs.map((input) => (
                  <p key={input.name} style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                    {input.name}: <span style={{ fontFamily: "monospace" }}>{actionInputs[input.name] || "—"}</span>
                  </p>
                ))}
              </div>
            )}
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
              <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,100,100,0.9)", marginBottom: 8 }}>
                ⚠️ Please fix:
              </p>
              {buildResult.errors.map((err, i) => (
                <p key={i} style={{ fontSize: 12, color: "rgba(255,100,100,0.8)", marginTop: 4 }}>
                  • {err}
                </p>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={submitProposal}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "18px 24px",
              borderRadius: 12,
              border: "2px solid rgba(0,255,140,0.5)",
              background: canSubmit ? "rgba(0,255,140,0.2)" : "rgba(100,100,100,0.2)",
              color: canSubmit ? "rgba(0,255,140,0.95)" : "rgba(150,150,150,0.8)",
              fontSize: 16,
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {isPending ? "⏳ SUBMITTING..." : "🚀 SUBMIT PROPOSAL"}
          </button>

          {!isConnected && (
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,200,100,0.9)", textAlign: "center" }}>
              ⚠️ Connect your wallet to submit
            </p>
          )}

          {/* Transaction Status */}
          {txHash && (
            <div style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              background: receipt.isSuccess ? "rgba(100,255,150,0.1)" : "rgba(100,200,255,0.1)",
              border: `1px solid ${receipt.isSuccess ? "rgba(100,255,150,0.3)" : "rgba(100,200,255,0.3)"}`,
            }}>
              <p style={{ fontSize: 12, color: receipt.isSuccess ? "rgba(100,255,150,0.9)" : "rgba(100,200,255,0.9)" }}>
                {receipt.isLoading ? "⏳ Confirming..." : receipt.isSuccess ? "✅ Proposal created!" : ""}
              </p>
              {receipt.isSuccess && (
                <Link href="/governance" style={{ fontSize: 12, color: "rgba(0,255,140,0.8)", marginTop: 8, display: "block" }}>
                  → View all proposals
                </Link>
              )}
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

          {/* Info Box */}
          <div style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 10,
            background: "rgba(100,200,255,0.05)",
            border: "1px solid rgba(100,200,255,0.2)",
          }}>
            <p style={{ fontSize: 11, color: "rgba(100,200,255,0.8)", lineHeight: 1.5 }}>
              💡 <strong>How voting works:</strong><br />
              After submission, BRRR token holders can vote FOR, AGAINST, or ABSTAIN. 
              If the proposal passes quorum and has majority FOR votes, it can be queued 
              and executed via the Timelock.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Responsive */}
      <style jsx>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 380px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
