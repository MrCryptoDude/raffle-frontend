"use client";

import { useChainId, useSwitchChain, useAccount } from "wagmi";
import { REQUIRED_CHAIN_ID } from "../../lib/addresses";

export function useNetworkCheck() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  async function switchToCorrectNetwork(): Promise<boolean> {
    if (!isWrongNetwork) return true;
    
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
      return true;
    } catch (e) {
      console.error("Failed to switch network:", e);
      return false;
    }
  }

  // Call this before any transaction - returns true if on correct network
  async function ensureCorrectNetwork(): Promise<boolean> {
    if (!isConnected) return false;
    if (!isWrongNetwork) return true;
    
    return await switchToCorrectNetwork();
  }

  return {
    isWrongNetwork,
    isSwitching,
    switchToCorrectNetwork,
    ensureCorrectNetwork,
  };
}
