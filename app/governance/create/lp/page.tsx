"use client";

import * as React from "react";
import Link from "next/link";
import { keccak256, toBytes, encodeFunctionData, isAddress, parseUnits } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

// Uniswap V3 Position Manager (same on mainnet and sepolia for Base)
const POSITION_MANAGER_MAINNET = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const POSITION_MANAGER_SEPOLIA = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2";
const WETH = "0x4200000000000000000000000000000000000006";

// NonfungiblePositionManager ABI (subset)
const positionManagerAbi = [
  {
    name: "collect",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "amount0Max", type: "uint128" },
          { name: "amount1Max", type: "uint128" },
        ],
      },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "decreaseLiquidity",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "liquidity", type: "uint128" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

// ERC20 ABI for approvals
const erc20Abi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const ACTIONS = [
  {
    id: "collectFees",
    label: "Collect LP Fees",
    description: "Collect accumulated trading fees from the DAO-owned LP position",
    icon: "💸",
    fields: ["tokenId", "recipient"],
  },
  {
    id: "removeLiquidity",
    label: "Remove Liquidity",
    description: "Remove some or all liquidity from the DAO-owned LP position",
    icon: "📤",
    fields: ["tokenId", "liquidityPercent", "recipient"],
  },
  {
    id: "transferTokens",
    label: "Transfer Tokens",
    description: "Transfer tokens from the Timelock treasury to an address",
    icon: "💰",
    fields: ["token", "recipient", "amount"],
  },
];

export default function LPProposalPage() {
  const { isConnected } = useAccount();
  const governor = addresses.governor;
  const timelock = addresses.timelock;

  // Use appropriate position manager based on chain
  const positionManager = POSITION_MANAGER_SEPOLIA; // Default to testnet

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedAction, setSelectedAction] = React.useState<string>("collectFees");
  const [tokenId, setTokenId] = React.useState("");
  const [recipient, setRecipient] = React.useState("");
  const [liquidityPercent, setLiquidityPercent] = React.useState("100");
  const [tokenAddress, setTokenAddress] = React.useState("");
  const [amount, setAmount] = React.useState("");

  // Auto-generate title
  React.useEffect(() => {
    if (selectedAction === "collectFees") {
      setTitle(`Collect LP Fees from Position #${tokenId || "?"}`);
    } else if (selectedAction === "removeLiquidity") {
      setTitle(`Remove ${liquidityPercent}% Liquidity from Position #${tokenId || "?"}`);
    } else if (selectedAction === "transferTokens") {
      setTitle(`Transfer Tokens from Treasury`);
    }
  }, [selectedAction, tokenId, liquidityPercent]);

  // Build proposal
  const buildResult = React.useMemo(() => {
    const errors: string[] = [];

    if (!title.trim()) errors.push("Title is required");
    if (!description.trim()) errors.push("Description is required");
    if (!timelock) errors.push("Timelock address not configured");

    const targets: `0x${string}`[] = [];
    const values: bigint[] = [];
    const calldatas: `0x${string}`[] = [];

    try {
      if (selectedAction === "collectFees") {
        if (!tokenId || isNaN(Number(tokenId))) {
          errors.push("Valid LP position token ID is required");
        }
        const recipientAddr = recipient || timelock;
        if (!isAddress(recipientAddr!)) {
          errors.push("Valid recipient address is required");
        }

        if (errors.length === 0) {
          const calldata = encodeFunctionData({
            abi: positionManagerAbi,
            functionName: "collect",
            args: [{
              tokenId: BigInt(tokenId),
              recipient: recipientAddr as `0x${string}`,
              amount0Max: BigInt("340282366920938463463374607431768211455"), // type(uint128).max
              amount1Max: BigInt("340282366920938463463374607431768211455"),
            }],
          });
          targets.push(positionManager as `0x${string}`);
          values.push(0n);
          calldatas.push(calldata);
        }
      } else if (selectedAction === "removeLiquidity") {
        if (!tokenId || isNaN(Number(tokenId))) {
          errors.push("Valid LP position token ID is required");
        }
        if (!liquidityPercent || Number(liquidityPercent) <= 0 || Number(liquidityPercent) > 100) {
          errors.push("Liquidity percent must be between 1-100");
        }
        const recipientAddr = recipient || timelock;
        if (!isAddress(recipientAddr!)) {
          errors.push("Valid recipient address is required");
        }

        if (errors.length === 0) {
          // Note: In real implementation, you'd need to query the position's liquidity first
          // For now, we'll use a placeholder that the proposer needs to fill in
          errors.push("For removeLiquidity, you need to specify the exact liquidity amount. Query the position first.");
        }
      } else if (selectedAction === "transferTokens") {
        if (!isAddress(tokenAddress)) {
          errors.push("Valid token address is required");
        }
        if (!isAddress(recipient)) {
          errors.push("Valid recipient address is required");
        }
        if (!amount || isNaN(Number(amount))) {
          errors.push("Valid amount is required");
        }

        if (errors.length === 0) {
          // Assume 18 decimals for most tokens, 6 for USDC
          const decimals = tokenAddress.toLowerCase() === addresses.usdc?.toLowerCase() ? 6 : 18;
          const amountWei = parseUnits(amount, decimals);

          const calldata = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipient as `0x${string}`, amountWei],
          });
          targets.push(tokenAddress as `0x${string}`);
          values.push(0n);
          calldatas.push(calldata);
        }
      }
    } catch (e: any) {
      errors.push(`Encoding error: ${e?.message || "Unknown"}`);
    }

    if (errors.length > 0) {
      return { errors, targets: [], values: [], calldatas: [], fullDescription: "" };
    }

    const fullDescription = `${title}\n\n${description}`;

    return { errors: [], targets, values, calldatas, fullDescription };
  }, [title, description, selectedAction, tokenId, recipient, liquidityPercent, tokenAddress, amount, timelock, positionManager]);

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
        border: "1px solid rgba(100,200,255,0.3)",
        textAlign: "center",
      }}>
        <Link href="/governance/create" style={{ fontSize: 13, color: "rgba(100,200,255,0.7)", textDecoration: "none" }}>
          ← Back to Categories
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgba(100,200,255,0.95)", marginTop: 16 }}>
          💰 COMMUNITY LP
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Manage DAO-owned liquidity pool and treasury
        </p>
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "rgba(100,200,255,0.1)",
          border: "1px solid rgba(100,200,255,0.3)",
          borderRadius: 10,
          display: "inline-block",
        }}>
          <p style={{ fontSize: 12, color: "rgba(100,200,255,0.9)" }}>
            💡 This is for <strong>community-owned LP</strong> controlled by DAO governance, not the protocol-owned LP
          </p>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, marginTop: 20 }}>
        {/* Left - Form */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 16,
          border: "1px solid rgba(100,200,255,0.15)",
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
                    borderColor: selectedAction === action.id ? "rgba(100,200,255,0.5)" : "rgba(255,255,255,0.1)",
                    background: selectedAction === action.id ? "rgba(100,200,255,0.1)" : "rgba(0,0,0,0.2)",
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

            {/* Token ID Input */}
            {currentAction?.fields.includes("tokenId") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  LP Position NFT Token ID
                </label>
                <input
                  type="number"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="e.g., 12345"
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
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                  Find this on the Uniswap position page or from deployment logs
                </p>
              </div>
            )}

            {/* Recipient Input */}
            {currentAction?.fields.includes("recipient") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  Recipient Address (leave blank for Timelock)
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={timelock || "0x..."}
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

            {/* Liquidity Percent */}
            {currentAction?.fields.includes("liquidityPercent") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  Liquidity to Remove (%)
                </label>
                <input
                  type="number"
                  value={liquidityPercent}
                  onChange={(e) => setLiquidityPercent(e.target.value)}
                  min="1"
                  max="100"
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

            {/* Token Address */}
            {currentAction?.fields.includes("token") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  Token Address
                </label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
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
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => setTokenAddress(WETH)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(100,200,255,0.3)",
                      background: "rgba(100,200,255,0.1)",
                      color: "rgba(100,200,255,0.9)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    WETH
                  </button>
                  {addresses.brrr && (
                    <button
                      onClick={() => setTokenAddress(addresses.brrr!)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(0,255,140,0.3)",
                        background: "rgba(0,255,140,0.1)",
                        color: "rgba(0,255,140,0.9)",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      BRRR
                    </button>
                  )}
                  {addresses.usdc && (
                    <button
                      onClick={() => setTokenAddress(addresses.usdc!)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,200,100,0.3)",
                        background: "rgba(255,200,100,0.1)",
                        color: "rgba(255,200,100,0.9)",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      USDC
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Amount */}
            {currentAction?.fields.includes("amount") && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                  Amount (human readable)
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 1000"
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
          </div>

          {/* Step 3: Description */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
              3️⃣ Justification
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                Title
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
                placeholder="Explain the purpose and how the funds will be used..."
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
          border: "1px solid rgba(100,200,255,0.15)",
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
            background: "rgba(100,200,255,0.15)",
            border: "1px solid rgba(100,200,255,0.3)",
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(100,200,255,0.95)" }}>
              💰 Community LP
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
              <p style={{ fontSize: 13, color: "rgba(100,200,255,0.9)", fontWeight: 600 }}>
                {currentAction?.icon} {currentAction?.label}
              </p>
            </div>

            {currentAction?.fields.includes("tokenId") && tokenId && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>POSITION ID</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>#{tokenId}</p>
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
              borderColor: canSubmit ? "rgba(100,200,255,0.5)" : "rgba(100,100,100,0.3)",
              background: canSubmit ? "rgba(100,200,255,0.2)" : "rgba(100,100,100,0.2)",
              color: canSubmit ? "rgba(100,200,255,0.95)" : "rgba(150,150,150,0.8)",
              fontSize: 16,
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {isPending ? "⏳ SUBMITTING..." : "🚀 SUBMIT PROPOSAL"}
          </button>

          {!isConnected && (
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(100,200,255,0.9)", textAlign: "center" }}>
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
