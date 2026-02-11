"use client";

import * as React from "react";
import { useAccount, useReadContract, useWriteContract, useChainId, useSwitchChain } from "wagmi";
import { formatUnits, parseUnits } from "viem";

import {
  addresses,
  USDC_DECIMALS,
  RAFFLE_DECIMALS,
  REQUIRED_CHAIN_ID,
} from "../../lib/addresses";
import { erc20Abi, stakingAbi } from "../../lib/abis";

function formatNumber(v: bigint | undefined, decimals: number, maxDecimals = 2) {
  if (v === undefined) return "—";
  const num = Number(formatUnits(v, decimals));
  if (num === 0) return "0";
  if (num < 0.01) return "<0.01";
  return num.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

function formatFull(v: bigint | undefined, decimals: number) {
  if (v === undefined) return "—";
  return formatUnits(v, decimals);
}

function isAddress(x: unknown): x is `0x${string}` {
  return typeof x === "string" && /^0x[a-fA-F0-9]{40}$/.test(x);
}

// Countdown timer component
function EpochCountdown({ endsAt }: { endsAt: bigint | undefined }) {
  const [timeLeft, setTimeLeft] = React.useState("");

  React.useEffect(() => {
    if (!endsAt || endsAt === 0n) {
      setTimeLeft("—");
      return;
    }

    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(endsAt);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Rolling over...");
        return;
      }

      const hours = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return <span>{timeLeft}</span>;
}

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingNetwork } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"stake" | "withdraw">("stake");

  const hasAddresses = isAddress(addresses.raffle) && isAddress(addresses.staking);

  const addr0 = "0x0000000000000000000000000000000000000000" as const;
  const user = (address ?? addr0) as `0x${string}`;

  async function ensureCorrectNetwork(): Promise<boolean> {
    if (!isConnected) return false;
    if (!wrongNetwork) return true;
    
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
      return true;
    } catch (e) {
      console.error("Failed to switch network:", e);
      setStatus("Please switch to Base to continue.");
      return false;
    }
  }

  // ---------- Reads ----------
  const raffleBalQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: addresses.raffle,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2500 },
  });

  const stakedBalQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2500 },
  });

  const earnedUsdcQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "earnedUSDC",
    args: [user],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2500 },
  });

  const earnedBrrrQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "earnedBRRR",
    args: [user],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2500 },
  });

  const epochRewardUsdcQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "getRewardForCurrentEpochUSDC",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const epochRewardBrrrQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "getRewardForCurrentEpochBRRR",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const epochEndsUsdcQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "epochEndsAtUSDC",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const totalStakedQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: addresses.raffle,
    functionName: "balanceOf",
    args: [addresses.staking],
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const allowanceQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: erc20Abi,
    address: addresses.raffle,
    functionName: "allowance",
    args: [user, addresses.staking],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2500 },
  });

  // ---------- Derived ----------
  const stakedBal = stakedBalQ.data ?? 0n;
  const walletBal = raffleBalQ.data ?? 0n;
  const totalStaked = totalStakedQ.data ?? 0n;

  const amountWei = React.useMemo(() => {
    try {
      return parseUnits(amount === "" ? "0" : amount, RAFFLE_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const allowance = allowanceQ.data ?? 0n;
  const needsApprove = !!address && amountWei > 0n && allowance < amountWei;

  // Calculate user's share of pool
  const userShare = totalStaked > 0n && stakedBal > 0n
    ? Number((stakedBal * 10000n) / totalStaked) / 100
    : 0;

  // Estimated daily earnings
  const epochRewardUsdc = epochRewardUsdcQ.data ?? 0n;
  const epochRewardBrrr = epochRewardBrrrQ.data ?? 0n;
  
  const estimatedDailyUsdc = totalStaked > 0n && stakedBal > 0n
    ? (epochRewardUsdc * stakedBal) / totalStaked
    : 0n;
  
  const estimatedDailyBrrr = totalStaked > 0n && stakedBal > 0n
    ? (epochRewardBrrr * stakedBal) / totalStaked
    : 0n;

  async function tx(label: string, fn: () => Promise<unknown>) {
    const networkOk = await ensureCorrectNetwork();
    if (!networkOk) return;

    try {
      setStatus(label);
      await fn();
      setStatus(`${label} ✓`);
      setAmount("");
    } catch (e: any) {
      setStatus(`ERROR: ${e?.shortMessage || e?.message || "TX failed"}`);
      console.error(e);
    } finally {
      setTimeout(() => setStatus(""), 4000);
    }
  }

  const writesEnabled = !!address && hasAddresses;

  async function approve() {
    if (!writesEnabled || amountWei === 0n) return;
    await tx("Approving...", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: erc20Abi,
        address: addresses.raffle,
        functionName: "approve",
        args: [addresses.staking, amountWei],
      })
    );
  }

  async function stake() {
    if (!writesEnabled || amountWei === 0n || needsApprove) return;
    await tx("Staking...", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: stakingAbi,
        address: addresses.staking,
        functionName: "stake",
        args: [amountWei],
      })
    );
  }

  async function withdraw() {
    if (!writesEnabled || amountWei === 0n || amountWei > stakedBal) return;
    await tx("Withdrawing...", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: stakingAbi,
        address: addresses.staking,
        functionName: "withdraw",
        args: [amountWei],
      })
    );
  }

  async function claim() {
    if (!writesEnabled) return;
    await tx("Claiming...", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: stakingAbi,
        address: addresses.staking,
        functionName: "claim",
        args: [],
      })
    );
  }

  function setMax() {
    if (activeTab === "stake") {
      setAmount(formatUnits(walletBal, RAFFLE_DECIMALS));
    } else {
      setAmount(formatUnits(stakedBal, RAFFLE_DECIMALS));
    }
  }

  async function handleSwitchNetwork() {
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch (e) {
      console.error("Switch network failed:", e);
    }
  }

  const earnedUsdc = earnedUsdcQ.data ?? 0n;
  const earnedBrrr = earnedBrrrQ.data ?? 0n;
  const hasEarnings = earnedUsdc > 0n || earnedBrrr > 0n;

  return (
    <main style={{ 
      minHeight: "100vh", 
      padding: "24px 16px",
      background: "linear-gradient(180deg, #0a0a0a 0%, #0d1a0f 50%, #0a0a0a 100%)",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 900,
            background: "linear-gradient(135deg, #00ff8c 0%, #00cc70 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}>
            STAKING
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Stake BRRR to earn protocol revenue • Rewards stream over 24h epochs
          </p>
          {status && (
            <div style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 8,
              background: status.includes("ERROR") ? "rgba(255,100,100,0.15)" : "rgba(0,255,140,0.15)",
              border: `1px solid ${status.includes("ERROR") ? "rgba(255,100,100,0.3)" : "rgba(0,255,140,0.3)"}`,
              display: "inline-block",
              fontSize: 12,
              color: status.includes("ERROR") ? "rgba(255,100,100,0.9)" : "rgba(0,255,140,0.9)",
            }}>
              {status}
            </div>
          )}
        </div>

        {wrongNetwork && (
          <div style={{
            background: "rgba(255,100,100,0.1)",
            border: "1px solid rgba(255,100,100,0.3)",
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            marginBottom: 24,
          }}>
            <div style={{ color: "rgba(255,100,100,0.9)", fontWeight: 700, marginBottom: 8 }}>
              Wrong Network
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 16 }}>
              Please switch to Base to use staking.
            </div>
            <button 
              onClick={handleSwitchNetwork}
              disabled={isSwitchingNetwork}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: "rgba(255,100,100,0.2)",
                border: "1px solid rgba(255,100,100,0.4)",
                color: "rgba(255,255,255,0.9)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isSwitchingNetwork ? "Switching..." : "Switch Network"}
            </button>
          </div>
        )}

        {/* Main Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}>
          {/* Your Position Card */}
          <div style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 24,
          }}>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              color: "rgba(255,255,255,0.4)", 
              letterSpacing: 1.5,
              marginBottom: 20,
            }}>
              YOUR POSITION
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Wallet</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                  {formatNumber(walletBal, RAFFLE_DECIMALS)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>BRRR</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Staked</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "rgba(0,255,140,0.9)" }}>
                  {formatNumber(stakedBal, RAFFLE_DECIMALS)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>BRRR</div>
              </div>
            </div>

            {stakedBal > 0n && (
              <div style={{
                background: "rgba(0,255,140,0.05)",
                border: "1px solid rgba(0,255,140,0.15)",
                borderRadius: 10,
                padding: 12,
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: "rgba(0,255,140,0.7)", marginBottom: 4 }}>Pool Share</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(0,255,140,0.9)" }}>
                  {userShare.toFixed(2)}%
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setActiveTab("stake")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeTab === "stake" ? "rgba(0,255,140,0.2)" : "rgba(255,255,255,0.05)",
                  color: activeTab === "stake" ? "rgba(0,255,140,0.9)" : "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Stake
              </button>
              <button
                onClick={() => setActiveTab("withdraw")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeTab === "withdraw" ? "rgba(255,200,100,0.2)" : "rgba(255,255,255,0.05)",
                  color: activeTab === "withdraw" ? "rgba(255,200,100,0.9)" : "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Withdraw
              </button>
            </div>

            {/* Amount Input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Amount</span>
                <button
                  onClick={setMax}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(0,255,140,0.7)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  MAX
                </button>
              </div>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 18,
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            </div>

            {/* Action Buttons */}
            {activeTab === "stake" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={approve}
                  disabled={!writesEnabled || amountWei === 0n || !needsApprove}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: !needsApprove ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: needsApprove ? "pointer" : "not-allowed",
                  }}
                >
                  {!needsApprove ? "✓ Approved" : "Approve"}
                </button>
                <button
                  onClick={stake}
                  disabled={!writesEnabled || amountWei === 0n || needsApprove}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 10,
                    border: "none",
                    background: needsApprove || amountWei === 0n 
                      ? "rgba(0,255,140,0.2)" 
                      : "linear-gradient(135deg, rgba(0,255,140,0.4) 0%, rgba(0,200,100,0.3) 100%)",
                    color: needsApprove || amountWei === 0n ? "rgba(0,255,140,0.4)" : "rgba(255,255,255,0.95)",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: needsApprove || amountWei === 0n ? "not-allowed" : "pointer",
                    boxShadow: needsApprove || amountWei === 0n ? "none" : "0 0 20px rgba(0,255,140,0.2)",
                  }}
                >
                  Stake
                </button>
              </div>
            ) : (
              <button
                onClick={withdraw}
                disabled={!writesEnabled || amountWei === 0n || amountWei > stakedBal}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 10,
                  border: "none",
                  background: amountWei === 0n || amountWei > stakedBal
                    ? "rgba(255,200,100,0.2)"
                    : "linear-gradient(135deg, rgba(255,200,100,0.4) 0%, rgba(200,150,50,0.3) 100%)",
                  color: amountWei === 0n || amountWei > stakedBal ? "rgba(255,200,100,0.4)" : "rgba(255,255,255,0.95)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: amountWei === 0n || amountWei > stakedBal ? "not-allowed" : "pointer",
                }}
              >
                Withdraw
              </button>
            )}

            {activeTab === "withdraw" && amountWei > stakedBal && (
              <div style={{ 
                marginTop: 8, 
                fontSize: 11, 
                color: "rgba(255,100,100,0.8)",
                textAlign: "center",
              }}>
                Insufficient staked balance
              </div>
            )}
          </div>

          {/* Rewards Card */}
          <div style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 24,
          }}>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              color: "rgba(255,255,255,0.4)", 
              letterSpacing: 1.5,
              marginBottom: 20,
            }}>
              YOUR REWARDS
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: 16, 
              marginBottom: 20,
            }}>
              <div style={{
                background: "rgba(0,255,140,0.05)",
                border: "1px solid rgba(0,255,140,0.15)",
                borderRadius: 12,
                padding: 16,
              }}>
                <div style={{ fontSize: 11, color: "rgba(0,255,140,0.6)", marginBottom: 6 }}>Earned USDC</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(0,255,140,0.95)" }}>
                  {formatNumber(earnedUsdc, USDC_DECIMALS, 4)}
                </div>
              </div>
              <div style={{
                background: "rgba(255,200,100,0.05)",
                border: "1px solid rgba(255,200,100,0.15)",
                borderRadius: 12,
                padding: 16,
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,200,100,0.6)", marginBottom: 6 }}>Earned BRRR</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,200,100,0.95)" }}>
                  {formatNumber(earnedBrrr, RAFFLE_DECIMALS, 2)}
                </div>
              </div>
            </div>

            <button
              onClick={claim}
              disabled={!writesEnabled || !hasEarnings}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 12,
                border: "none",
                background: hasEarnings 
                  ? "linear-gradient(135deg, rgba(0,255,140,0.3) 0%, rgba(255,200,100,0.2) 100%)"
                  : "rgba(255,255,255,0.05)",
                color: hasEarnings ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.3)",
                fontWeight: 700,
                fontSize: 15,
                cursor: hasEarnings ? "pointer" : "not-allowed",
                boxShadow: hasEarnings ? "0 0 30px rgba(0,255,140,0.15)" : "none",
                marginBottom: 24,
              }}
            >
              {hasEarnings ? "💰 Claim All Rewards" : "No Rewards to Claim"}
            </button>

            {/* Estimated Daily */}
            {stakedBal > 0n && (
              <>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: "rgba(255,255,255,0.4)", 
                  letterSpacing: 1.5,
                  marginBottom: 12,
                }}>
                  ESTIMATED DAILY EARNINGS
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    padding: 12,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(0,255,140,0.8)" }}>
                      ~{formatNumber(estimatedDailyUsdc, USDC_DECIMALS, 4)}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>USDC/day</div>
                  </div>
                  <div style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    padding: 12,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,200,100,0.8)" }}>
                      ~{formatNumber(estimatedDailyBrrr, RAFFLE_DECIMALS, 2)}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>BRRR/day</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Protocol Stats Card */}
          <div style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 24,
            gridColumn: "1 / -1",
          }}>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              color: "rgba(255,255,255,0.4)", 
              letterSpacing: 1.5,
              marginBottom: 20,
            }}>
              PROTOCOL STATS
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 16,
            }}>
              <div style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>
                  TOTAL STAKED
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                  {formatNumber(totalStaked, RAFFLE_DECIMALS)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>BRRR</div>
              </div>

              <div style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>
                  EPOCH REWARDS (USDC)
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(0,255,140,0.9)" }}>
                  {formatNumber(epochRewardUsdc, USDC_DECIMALS, 2)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>streaming now</div>
              </div>

              <div style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>
                  EPOCH REWARDS (BRRR)
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,200,100,0.9)" }}>
                  {formatNumber(epochRewardBrrr, RAFFLE_DECIMALS, 0)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>streaming now</div>
              </div>

              <div style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>
                  NEXT EPOCH IN
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                  <EpochCountdown endsAt={epochEndsUsdcQ.data} />
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>auto-rolls</div>
              </div>
            </div>

            <div style={{ 
              marginTop: 20, 
              padding: 16, 
              background: "rgba(0,255,140,0.03)",
              border: "1px solid rgba(0,255,140,0.1)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                <strong style={{ color: "rgba(0,255,140,0.8)" }}>How it works:</strong> Protocol fees from Raffle (USDC) and RPS (BRRR) 
                are distributed to stakers over 24-hour epochs. Stake more BRRR to earn a larger share of rewards.
                Rewards accrue in real-time and can be claimed at any time.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
