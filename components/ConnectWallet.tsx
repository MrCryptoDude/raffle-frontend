"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
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
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  async function onConnect() {
    try {
      // Connect with injected connector
      await connectAsync({ connector: injected() });
      
      // After connecting, check if we need to switch networks
      // Small delay to let wagmi update chainId
      setTimeout(async () => {
        try {
          await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
        } catch (e) {
          console.log("Network switch prompt dismissed or failed:", e);
        }
      }, 100);
    } catch (e) {
      console.error("Connect failed:", e);
    }
  }

  async function onSwitchNetwork() {
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch (e) {
      console.error("Switch network failed:", e);
    }
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
        <button 
          className="btn btnGold" 
          style={{ marginLeft: 8 }}
          onClick={onSwitchNetwork}
          disabled={isSwitching}
        >
          {isSwitching ? "SWITCHING..." : "SWITCH TO BASE SEPOLIA"}
        </button>
      )}

      <button className="btn btnBlue" onClick={() => disconnect()}>
        DISCONNECT
      </button>
    </div>
  );
}
