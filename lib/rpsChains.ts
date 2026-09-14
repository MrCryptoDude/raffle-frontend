import { defineChain } from "viem";
import { base, baseSepolia } from "wagmi/chains";

import { REQUIRED_CHAIN_ID } from "./addresses";

/**
 * Robinhood Chain mainnet. viem has no built-in definition for it yet.
 * Multicall3 is deployed at the usual address, so batched reads work.
 */
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/** The Base network the rest of the site runs on: mainnet, or Sepolia when testing. */
export const baseChain = REQUIRED_CHAIN_ID === 8453 ? base : baseSepolia;

/** EVM chains the site's wallet config knows about. */
export const SUPPORTED_CHAIN_IDS: number[] = [baseChain.id, robinhood.id];

/**
 * Where Robinhood Chain reads go. Its public node sometimes answers with the
 * CORS header set twice, which browsers reject, so the browser goes through
 * the site's own proxy while the server can call the node directly.
 */
export const ROBINHOOD_RPC_UPSTREAM = process.env.NEXT_PUBLIC_RH_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_RPC = typeof window === "undefined" ? ROBINHOOD_RPC_UPSTREAM : "/api/rpc?chain=robinhood";

export type RpsChainKey = "base" | "robinhood" | "solana";

export type RpsChain = {
  key: RpsChainKey;
  /** Full name, e.g. "Robinhood Chain". */
  name: string;
  /** Short label for badges. */
  badge: string;
  /** Accent color for the badge. */
  color: string;
  kind: "evm" | "solana";
  /** EVM chain id; undefined on Solana. */
  chainId?: number;
  /** Game contract address, or program id on Solana. Empty until deployed. */
  game: string;
  explorer: string;
};

export const RPS_CHAINS: RpsChain[] = [
  {
    key: "base",
    name: "Base",
    badge: "BASE",
    color: "#4f8bff",
    kind: "evm",
    chainId: baseChain.id,
    game: process.env.NEXT_PUBLIC_RPS_PVP_BASE || process.env.NEXT_PUBLIC_RPS_PVP || "",
    explorer: baseChain.blockExplorers.default.url,
  },
  {
    key: "robinhood",
    name: "Robinhood Chain",
    badge: "RH",
    color: "#ccff00",
    kind: "evm",
    chainId: robinhood.id,
    game: process.env.NEXT_PUBLIC_RPS_PVP_ROBINHOOD || "",
    explorer: robinhood.blockExplorers.default.url,
  },
  {
    key: "solana",
    name: "Solana",
    badge: "SOL",
    color: "#b98bff",
    kind: "solana",
    game: process.env.NEXT_PUBLIC_RPS_PVP_SOLANA || "",
    explorer: "https://solscan.io",
  },
];

export function rpsChain(key: RpsChainKey): RpsChain {
  return RPS_CHAINS.find((c) => c.key === key) as RpsChain;
}

/** Chains that have a game deployed, in display order. */
export const LIVE_RPS_CHAINS = RPS_CHAINS.filter((c) => c.game !== "");

/** EVM chains that have a game deployed. */
export const LIVE_EVM_RPS_CHAINS = LIVE_RPS_CHAINS.filter((c) => c.kind === "evm");
