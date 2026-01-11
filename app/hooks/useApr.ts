import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { STAKING_REWARDS_ABI } from "@/abi/StakingRewards";
import { STAKING_REWARDS_ADDRESS } from "@/config/contracts";

const SECONDS_PER_YEAR = 31_536_000n;
const SCALE = 10n ** 18n;

export function useApr() {
  const { data: rewardRate } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: "rewardRate",
  });

  const { data: totalStaked } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: "totalSupply",
  });

  if (!rewardRate || !totalStaked || totalStaked === 0n) {
    return {
      apr: null,
      isLoading: true,
    };
  }

  /**
   * APR = (rewardRate * secondsPerYear) / totalStaked
   * All math stays in bigint
   */
  const aprScaled =
    (rewardRate * SECONDS_PER_YEAR * SCALE) / totalStaked;

  const aprPercent =
    Number(aprScaled) / Number(SCALE) * 100;

  return {
    apr: aprPercent,
    isLoading: false,
  };
}
