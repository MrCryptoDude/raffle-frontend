export const addresses = {
  usdc: process.env.NEXT_PUBLIC_USDC as `0x${string}`,
  manager: process.env.NEXT_PUBLIC_MANAGER as `0x${string}`,
  staking: process.env.NEXT_PUBLIC_STAKING as `0x${string}`,
  raffle: process.env.NEXT_PUBLIC_RAFFLE as `0x${string}`,
  rps: process.env.NEXT_PUBLIC_RPS as `0x${string}`,
  vrfAdapter: process.env.NEXT_PUBLIC_VRF_ADAPTER as `0x${string}`,
};

export const REQUIRED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

export const USDC_DECIMALS = 6;
export const RAFFLE_DECIMALS = 18;
