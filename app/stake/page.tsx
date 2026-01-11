"use client";

import * as React from "react";
import { useAccount, useReadContract, useWriteContract, useChainId } from "wagmi";
import { formatUnits, parseUnits } from "viem";

import {
  addresses,
  USDC_DECIMALS,
  RAFFLE_DECIMALS,
  REQUIRED_CHAIN_ID,
} from "../../lib/addresses";
import { erc20Abi, stakingAbi } from "../../lib/abis";

function fmt(v: bigint | undefined, decimals: number) {
  if (v === undefined) return "—";
  return formatUnits(v, decimals);
}

function isAddress(x: unknown): x is `0x${string}` {
  return typeof x === "string" && /^0x[a-fA-F0-9]{40}$/.test(x);
}

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = React.useState("0");
  const [status, setStatus] = React.useState("");

  // Optional: manual BRRR price input (USDC per 1 BRRR) for APR calculation
  const [brrrPriceUsdc, setBrrrPriceUsdc] = React.useState("");

  const hasAddresses = isAddress(addresses.raffle) && isAddress(addresses.staking);

  const addr0 = "0x0000000000000000000000000000000000000000" as const;
  const user = (address ?? addr0) as `0x${string}`;

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

  const earnedQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "earned",
    args: [user],
    query: { enabled: !!address && hasAddresses, refetchInterval: 2500 },
  });

  const queuedQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "queuedRewards",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const pendingNextQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "pendingNextEpochRewards",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const epochRewardQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "getRewardForCurrentEpoch",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const epochEndsQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "epochEndsAt",
    query: { enabled: hasAddresses, refetchInterval: 2500 },
  });

  const paidQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "totalCumulativeRewardsPaid",
    query: { enabled: hasAddresses, refetchInterval: 4000 },
  });

  const notifiedQ = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: stakingAbi,
    address: addresses.staking,
    functionName: "totalCumulativeRewardsNotified",
    query: { enabled: hasAddresses, refetchInterval: 4000 },
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

  const stakedBal = stakedBalQ.data ?? 0n;
  const amountWei = parseUnits(amount === "" ? "0" : amount, RAFFLE_DECIMALS);
  const allowance = allowanceQ.data ?? 0n;

  const needsApprove = !!address && amountWei > 0n && allowance < amountWei;
  const withdrawInvalid = !address || amountWei === 0n || amountWei > stakedBal;

  const totalStaked = totalStakedQ.data ?? 0n; // BRRR
  const epochReward = epochRewardQ.data ?? 0n; // USDC

  // Metrics (BigInt-safe)
  const SCALE = 10n ** 18n;
  const usdcFactor = 10n ** BigInt(USDC_DECIMALS);
  const raffleFactor = 10n ** BigInt(RAFFLE_DECIMALS);

  const usdcPerBrrrPerDayScaled =
    totalStaked > 0n ? (epochReward * raffleFactor * SCALE) / (totalStaked * usdcFactor) : 0n;
  const usdcPerBrrrPerDay = Number(usdcPerBrrrPerDayScaled) / Number(SCALE);

  let apr24hUsd: number | null = null;
  let apr365Usd: number | null = null;

  let priceScaled: bigint | null = null;
  if (brrrPriceUsdc.trim() !== "") {
    try {
      priceScaled = parseUnits(brrrPriceUsdc, 18);
      if (priceScaled <= 0n) priceScaled = null;
    } catch {
      priceScaled = null;
    }
  }

  if (priceScaled && totalStaked > 0n) {
    const stakedValueUsdcScaled = (totalStaked * priceScaled) / raffleFactor;
    if (stakedValueUsdcScaled > 0n) {
      const epochRewardScaledTo1e18 = (epochReward * SCALE) / usdcFactor;
      const dailyRateScaled = (epochRewardScaledTo1e18 * SCALE) / stakedValueUsdcScaled;
      const dailyRate = Number(dailyRateScaled) / Number(SCALE);

      if (Number.isFinite(dailyRate)) {
        apr24hUsd = dailyRate * 100;
        apr365Usd = dailyRate * 365 * 100;
      }
    }
  }

  const epochEnds =
    epochEndsQ.data && epochEndsQ.data > 0n
      ? new Date(Number(epochEndsQ.data) * 1000).toLocaleString()
      : "—";

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

  const writesEnabled = !!address && !wrongNetwork && hasAddresses;

  async function approve() {
    if (!writesEnabled || amountWei === 0n) return;
    await tx("APPROVING", async () =>
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
    await tx("STAKING", async () =>
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
    if (!writesEnabled || withdrawInvalid) return;
    await tx("WITHDRAWING", async () =>
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
    await tx("CLAIMING", async () =>
      writeContractAsync({
        chainId: REQUIRED_CHAIN_ID,
        abi: stakingAbi,
        address: addresses.staking,
        functionName: "claim",
        args: [],
      })
    );
  }

  function setMaxWallet() {
    if (!raffleBalQ.data) return;
    setAmount(formatUnits(raffleBalQ.data, RAFFLE_DECIMALS));
  }

  function setMaxStaked() {
    if (!stakedBalQ.data) return;
    setAmount(formatUnits(stakedBalQ.data, RAFFLE_DECIMALS));
  }

  return (
    <main className="screen">
      <div className="panel px-5 py-4 text-center marqueePanel">
        <div className="h1">STAKE</div>
        <div className="muted tiny mt-2">STAKE BRRR • REWARDS STREAM OVER 24H</div>
        {status && <div className="muted tiny mt-2">{status}</div>}
      </div>

      {!hasAddresses && (
        <div className="panel px-5 py-3 text-center mt-4">
          <div className="danger tiny">CONFIG ERROR</div>
          <div className="muted tiny mt-1">Missing NEXT_PUBLIC_RAFFLE / NEXT_PUBLIC_STAKING (or invalid addresses).</div>
        </div>
      )}

      {wrongNetwork && (
        <div className="panel px-5 py-3 text-center mt-4">
          <div className="danger tiny">WRONG NETWORK</div>
          <div className="muted tiny mt-1">Switch to Base Sepolia (Chain ID {REQUIRED_CHAIN_ID}) to use staking.</div>
        </div>
      )}

      <div className="mt-5 potRow">
        <div className="panel potCard cabinetPot">
          <div className="h2">YOUR STAKE</div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">BRRR BALANCE</div>
            <div className="h2">{fmt(raffleBalQ.data, RAFFLE_DECIMALS)}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">STAKED</div>
            <div className="h2">{fmt(stakedBalQ.data, RAFFLE_DECIMALS)}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">EARNED (USDC)</div>
            <div className="h2">{fmt(earnedQ.data, USDC_DECIMALS)}</div>
          </div>

          <div className="mt-3">
            <div className="muted tiny">AMOUNT</div>
            <input className="input mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <button className="btn btnBlue flex-1" onClick={setMaxWallet} disabled={!address}>
                MAX WALLET
              </button>
              <button className="btn btnBlue flex-1" onClick={setMaxStaked} disabled={!address}>
                MAX STAKED
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn btnMint flex-1" onClick={approve} disabled={!writesEnabled || amountWei === 0n}>
              APPROVE
            </button>
            <button className="btn btnGold flex-1" onClick={stake} disabled={!writesEnabled || needsApprove || amountWei === 0n}>
              STAKE
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn btnGold flex-1" onClick={withdraw} disabled={!writesEnabled || withdrawInvalid}>
              WITHDRAW
            </button>
            <button className="btn btnMint flex-1" onClick={claim} disabled={!writesEnabled}>
              CLAIM
            </button>
          </div>

          {address && amountWei > stakedBal && <div className="danger tiny mt-2">WITHDRAW AMOUNT {" > "} STAKED</div>}
        </div>

        <div className="panel potCard cabinetPot">
          <div className="h2">REWARDS</div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">CURRENT 24H STREAM</div>
            <div className="h2">{fmt(epochRewardQ.data, USDC_DECIMALS)} USDC</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">EPOCH ENDS</div>
            <div className="muted tiny">{epochEnds}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">PENDING NEXT EPOCH</div>
            <div className="h2">{fmt(pendingNextQ.data, USDC_DECIMALS)} USDC</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">QUEUED (NO STAKERS)</div>
            <div className="h2">{fmt(queuedQ.data, USDC_DECIMALS)} USDC</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">TOTAL REVENUE NOTIFIED</div>
            <div className="h2">{fmt(notifiedQ.data, USDC_DECIMALS)} USDC</div>
          </div>
        </div>

        <div className="panel potCard cabinetPot">
          <div className="h2">APR</div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">TOTAL STAKED (BRRR)</div>
            <div className="h2">{fmt(totalStakedQ.data, RAFFLE_DECIMALS)}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">YIELD (USDC / BRRR / DAY)</div>
            <div className="h2">{Number.isFinite(usdcPerBrrrPerDay) ? usdcPerBrrrPerDay.toFixed(8) : "0.00000000"}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">BRRR PRICE (USDC) FOR APR</div>
            <input
              className="input mt-1"
              placeholder='e.g. "0.0123"'
              value={brrrPriceUsdc}
              onChange={(e) => setBrrrPriceUsdc(e.target.value)}
            />
            <div className="muted tiny mt-2">If blank/invalid, APR shows —. Replace later with a price feed.</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">24H APR (USD EST.)</div>
            <div className="h2">{apr24hUsd === null ? "—" : `${apr24hUsd.toFixed(2)}%`}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">365D APR (USD EST.)</div>
            <div className="h2">{apr365Usd === null ? "—" : `${apr365Usd.toFixed(2)}%`}</div>
          </div>

          <div className="mt-3 inset statBox">
            <div className="muted tiny">TOTAL PAID (USDC)</div>
            <div className="h2">{fmt(paidQ.data, USDC_DECIMALS)} USDC</div>
          </div>
        </div>
      </div>
    </main>
  );
}
