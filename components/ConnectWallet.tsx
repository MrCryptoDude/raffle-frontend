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
      await connectAsync({ connector: injected() });
      setTimeout(async () => {
        try {
          await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
        } catch {}
      }, 100);
    } catch {}
  }

  async function onSwitchNetwork() {
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch {}
  }

  if (!isConnected) {
    return (
      <button className="btn btnGold headerBtn" onClick={onConnect} disabled={isPending}>
        {isPending ? "..." : "CONNECT"}
      </button>
    );
  }

  return (
    <div className="walletRow">
      <span className="badge">{shortAddr(address)}</span>

      {wrongNetwork ? (
        <button className="btn btnGold headerBtn" onClick={onSwitchNetwork} disabled={isSwitching}>
          {isSwitching ? "..." : "SWITCH"}
        </button>
      ) : (
        <button className="btn btnBlue headerBtn" onClick={() => disconnect()}>
          Disconnect
        </button>
      )}
    </div>
  );
}
