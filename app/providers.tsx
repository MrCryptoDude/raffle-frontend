"use client";

import * as React from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RPC_URL } from "../lib/addresses";
import { baseChain, robinhood, ROBINHOOD_RPC } from "../lib/rpsChains";
import { RpsPvpProvider } from "../lib/RpsPvpContext";

const queryClient = new QueryClient();

// Base stays first: pages that do not name a chain (gas, history) read from it.
// Robinhood Chain is here for the rock paper scissors rooms deployed there.
const config = createConfig({
  chains: [baseChain, robinhood],
  connectors: [injected()],
  // Both Base networks get a transport: env decides which one is in use, and
  // the types need one for either.
  transports: {
    [base.id]: http(RPC_URL),
    [baseSepolia.id]: http(RPC_URL),
    [robinhood.id]: http(ROBINHOOD_RPC),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RpsPvpProvider>{children}</RpsPvpProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
