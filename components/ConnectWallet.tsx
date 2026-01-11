"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { REQUIRED_CHAIN_ID } from "../lib/addresses";

function shortAddr(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  async function onConnect() {
    // Generic injected connector (MetaMask, Coinbase Wallet extension, Rabby, Brave, etc.)
    await connectAsync({ connector: injected() });
  }

  if (!isConnected) {
    return (
      <button className="btn btnGold" onClick={onConnect} disabled={isPending}>
        {isPending ? "CONNECTING..." : "CONNECT"}
      </button>
    );
  }

  return (
    <div className="walletRow">
      <span className="badge">{shortAddr(address)}</span>

      {wrongNetwork && (
        <span className="badge" style={{ marginLeft: 8 }}>
          WRONG CHAIN
        </span>
      )}

      <button className="btn btnBlue" onClick={() => disconnect()}>
        DISCONNECT
      </button>
    </div>
  );
}
