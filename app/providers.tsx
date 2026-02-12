"use client";

import * as React from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RPC_URL, REQUIRED_CHAIN_ID } from "../lib/addresses";

const queryClient = new QueryClient();

// Create config based on chain ID
const config = REQUIRED_CHAIN_ID === 8453
  ? createConfig({
      chains: [base],
      connectors: [injected()],
      transports: {
        [base.id]: http(RPC_URL),
      },
      ssr: true,
    })
  : createConfig({
      chains: [baseSepolia],
      connectors: [injected()],
      transports: {
        [baseSepolia.id]: http(RPC_URL),
      },
      ssr: true,
    });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
