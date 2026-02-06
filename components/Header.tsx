"use client";

import Link from "next/link";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { REQUIRED_CHAIN_ID } from "../lib/addresses";
import { ConnectWallet } from "./ConnectWallet";
import { LinksMenu } from "./LinksMenu";
import { GamesMenu } from "./GamesMenu";

export function Header() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== REQUIRED_CHAIN_ID;

  return (
    <div className="screen headerScreen">
      <header className="panel headerPanel">
        <div className="headerLeft">
          <LinksMenu />
          <Link href="/" className="brandLink hideMobile">
            <div className="brand">BRRR RAFFLE ARCADE</div>
          </Link>
        </div>

        <div className="headerMid">
          <GamesMenu />

          <Link className="btn btnBlue menuBtn" href="/stake">
            STAKE
          </Link>

          {wrongNetwork && (
            <button className="btn btnGold" onClick={() => switchChain?.({ chainId: REQUIRED_CHAIN_ID })} disabled={isPending}>
              {isPending ? "..." : "SWITCH"}
            </button>
          )}
        </div>

        <div className="headerRight">
          <ConnectWallet />
        </div>
      </header>
    </div>
  );
}
