"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

// Signal proposals use a no-op call to the Timelock (send 0 ETH with empty data)
// This allows tracking votes on-chain without executing any state changes

export default function SignalProposalPage() {
  const { isConnected } = useAccount();
  const governor = addresses.governor;
  const timelock = addresses.timelock;

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<string>("general");

  const CATEGORIES = [
    { id: "general", label: "General Discussion", icon: "💬" },
    { id: "feature", label: "Feature Request", icon: "✨" },
    { id: "temperature", label: "Temperature Check", icon: "🌡️" },
    { id: "feedback", label: "Community Feedback", icon: "📝" },
  ];

  // Build proposal
  const buildResult = React.useMemo(() => {
    const errors: string[] = [];

    if (!title.trim()) errors.push("Title is required");
    if (title.length < 10) errors.push("Title should be at least 10 characters");
    if (!description.trim()) errors.push("Description is required");
    if (description.length < 50) errors.push("Description should be at least 50 characters");
    if (!timelock) errors.push("Timelock address not configured");

    if (errors.length > 0) {
      return { errors, targets: [], values: [], calldatas: [], fullDescription: "" };
    }

    const categoryInfo = CATEGORIES.find((c) => c.id === category);
    const fullDescription = `[SIGNAL] ${categoryInfo?.icon} ${title}\n\n${description}\n\n---\n⚠️ This is a signal proposal. It does not execute any on-chain actions. It exists to gauge community sentiment on this topic.`;

    return {
      errors: [],
      targets: [timelock as `0x${string}`],
      values: [0n],
      calldatas: ["0x" as `0x${string}`], // Empty calldata = no-op
      fullDescription,
    };
  }, [title, description, category, timelock]);

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

  return (
    <main className="screen">
      {/* Header */}
      <section style={{
        padding: "32px 24px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 16,
        border: "1px solid rgba(180,150,255,0.3)",
        textAlign: "center",
      }}>
        <Link href="/governance/create" style={{ fontSize: 13, color: "rgba(180,150,255,0.7)", textDecoration: "none" }}>
          ← Back to Categories
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgba(180,150,255,0.95)", marginTop: 16 }}>
          📢 SIGNAL PROPOSAL
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Gauge community sentiment without executing on-chain actions
        </p>
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "rgba(180,150,255,0.1)",
          border: "1px solid rgba(180,150,255,0.3)",
          borderRadius: 10,
          display: "inline-block",
        }}>
          <p style={{ fontSize: 12, color: "rgba(180,150,255,0.9)" }}>
            💡 Signal proposals are <strong>discussion only</strong> — the community decides how to act on the results
          </p>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, marginTop: 20 }}>
        {/* Left - Form */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(180,150,255,0.15)",
          padding: 24,
        }}>
          {/* Step 1: Category */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              1️⃣ Category
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: category === cat.id ? "rgba(180,150,255,0.5)" : "rgba(255,255,255,0.1)",
                    background: category === cat.id ? "rgba(180,150,255,0.1)" : "rgba(0,0,0,0.2)",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{cat.icon}</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 8 }}>
                    {cat.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Title */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              2️⃣ Title
            </h2>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want the community to vote on?"
              maxLength={100}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.3)",
                color: "rgba(255,255,255,0.9)",
                fontSize: 16,
              }}
            />
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, textAlign: "right" }}>
              {title.length}/100 characters
            </p>
          </div>

          {/* Step 3: Description */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              3️⃣ Description
            </h2>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Provide context for your proposal:\n\n• What problem does this address?\n• What are the options being considered?\n• What happens if FOR wins vs AGAINST?\n• Any relevant background information?`}
              rows={10}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.3)",
                color: "rgba(255,255,255,0.9)",
                fontSize: 14,
                lineHeight: 1.6,
                resize: "vertical",
              }}
            />
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
              Minimum 50 characters. Be clear about what FOR and AGAINST votes mean.
            </p>
          </div>

          {/* Tips */}
          <div style={{
            padding: 20,
            borderRadius: 12,
            background: "rgba(180,150,255,0.05)",
            border: "1px solid rgba(180,150,255,0.2)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(180,150,255,0.9)", marginBottom: 12 }}>
              💡 Tips for Good Signal Proposals
            </h3>
            <ul style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Be specific about what you&apos;re asking</li>
              <li>Explain the consequences of each outcome</li>
              <li>Provide relevant data or context</li>
              <li>Keep it focused on one topic</li>
              <li>Be neutral in your framing</li>
            </ul>
          </div>
        </div>

        {/* Right - Preview & Submit */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(180,150,255,0.15)",
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
            background: "rgba(180,150,255,0.15)",
            border: "1px solid rgba(180,150,255,0.3)",
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(180,150,255,0.95)" }}>
              📢 Signal Proposal
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
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>CATEGORY</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                {CATEGORIES.find((c) => c.id === category)?.icon} {CATEGORIES.find((c) => c.id === category)?.label}
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TITLE</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                {title || "—"}
              </p>
            </div>

            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>DESCRIPTION</p>
              <p style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.5,
                maxHeight: 100,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {description || "—"}
              </p>
            </div>
          </div>

          {/* No Execution Notice */}
          <div style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(180,150,255,0.1)",
            border: "1px solid rgba(180,150,255,0.2)",
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 12, color: "rgba(180,150,255,0.9)" }}>
              ⚡ <strong>No on-chain execution</strong> — this is for community voting only
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
              borderColor: canSubmit ? "rgba(180,150,255,0.5)" : "rgba(100,100,100,0.3)",
              background: canSubmit ? "rgba(180,150,255,0.2)" : "rgba(100,100,100,0.2)",
              color: canSubmit ? "rgba(180,150,255,0.95)" : "rgba(150,150,150,0.8)",
              fontSize: 16,
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {isPending ? "⏳ SUBMITTING..." : "🚀 SUBMIT PROPOSAL"}
          </button>

          {!isConnected && (
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(180,150,255,0.9)", textAlign: "center" }}>
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
