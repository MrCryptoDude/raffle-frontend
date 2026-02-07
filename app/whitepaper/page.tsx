"use client";

import * as React from "react";
import Link from "next/link";

export default function WhitepaperPage() {
  return (
    <main className="screen">
      {/* Header */}
      <section className="panel p-5 text-center">
        <div className="h1">BRRR PROTOCOL</div>
        <div className="muted text-[10px] mt-2">
          Technical Whitepaper • Fully On-Chain • DAO Governed
        </div>
        <div className="muted text-[10px] mt-2">
          <Link href="/" className="underline">
            ← Back to Arcade
          </Link>
        </div>
      </section>

      {/* Whitepaper body */}
      <section className="mt-5 panel p-5">
        <article className="inset p-5 space-y-6 text-[12px] leading-relaxed">

          <section>
            <div className="h2">Abstract</div>
            <p className="mt-2">
              BRRR is a fully decentralized, on-chain financial arcade deployed on Base.
              It combines protocol-owned liquidity (POL), DAO governance, and multiple
              revenue-generating game primitives into a single composable ecosystem.
            </p>
            <p className="mt-2">
              The system follows a strict Satoshi-style philosophy: no privileged externally
              owned accounts (EOAs), no custodial control, and all sensitive actions executed
              exclusively through on-chain governance via a timelocked DAO.
            </p>
          </section>

          <section>
            <div className="h2">Design Goals</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>No privileged EOAs or admin wallets</li>
              <li>On-chain governance for all protocol decisions</li>
              <li>Protocol-owned liquidity (POL)</li>
              <li>User fund sovereignty</li>
              <li>Composable, modular architecture</li>
            </ul>
          </section>

          <section>
            <div className="h2">High-Level Architecture</div>
            <p className="mt-2">
              The BRRR ecosystem is composed of independent but interoperable modules:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>BRRR (ERC20Votes governance token)</li>
              <li>OpenZeppelin Governor</li>
              <li>TimelockController</li>
              <li>Protocol-Owned Liquidity Treasury</li>
              <li>StakingRewards</li>
              <li>Raffle Protocol</li>
              <li>Rock–Paper–Scissors (RPS)</li>
              <li>Gas Prediction Market</li>
            </ul>
            <p className="mt-2">
              All privileged execution flows through:
            </p>
            <pre className="mt-2 text-[11px] bg-black/30 p-3 border border-[rgba(125,255,178,0.22)]">
BRRR → Governor → Timelock → Target Contract
            </pre>
          </section>

          <section>
            <div className="h2">Governance Model</div>
            <p className="mt-2">
              BRRR governance is implemented using OpenZeppelin’s Governor framework
              with ERC20Votes and a TimelockController. Voting power is snapshotted
              at proposal creation.
            </p>
            <p className="mt-2">
              Proposals must specify byte-exact targets, values, and calldata.
              Execution must match the proposal precisely or it will fail.
            </p>
          </section>

          <section>
            <div className="h2">Governance Safety Constraints</div>
            <p className="mt-2">
              Governance is explicitly restricted from controlling individual user funds.
            </p>
            <div className="mt-2">
              <div className="muted text-[11px]">Governance cannot:</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Withdraw or seize user balances</li>
                <li>Redirect user claims</li>
                <li>Vote on individual payouts</li>
                <li>Confiscate deposits from games</li>
              </ul>
            </div>
            <div className="mt-3">
              <div className="muted text-[11px]">Governance can:</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Manage protocol-owned liquidity</li>
                <li>Adjust protocol fees and routing</li>
                <li>Trigger emergency resets where explicitly allowed</li>
                <li>Upgrade contracts while preserving claimability</li>
              </ul>
            </div>
          </section>

          <section>
            <div className="h2">Protocol-Owned Liquidity (POL)</div>
            <p className="mt-2">
              Liquidity is owned by the protocol via a LiquidityTreasury contract
              controlled by governance. Liquidity is deployed using Uniswap V3
              positions represented by NFTs.
            </p>
            <p className="mt-2">
              Governance may mint, rebalance, and collect fees from these positions,
              but cannot arbitrarily extract user funds.
            </p>
          </section>

          <section>
            <div className="h2">Game Modules</div>

            <div className="mt-2">
              <div className="muted">Raffle Protocol</div>
              <p className="mt-1">
                Users buy tickets with USDC. Pots accumulate, winners are selected,
                and payouts are claimed directly by users.
              </p>
            </div>

            <div className="mt-3">
              <div className="muted">Rock–Paper–Scissors (RPS)</div>
              <p className="mt-1">
                Users play against the house using verifiable randomness.
                Bets, outcomes, and payouts are deterministic and transparent.
              </p>
            </div>

            <div className="mt-3">
              <div className="muted">Gas Prediction Market</div>
              <p className="mt-1">
                Users take long or short positions on future gas prices.
                Winning sides split losing liquidity proportionally.
              </p>
            </div>
          </section>

          <section>
            <div className="h2">Frontend Philosophy</div>
            <p className="mt-2">
              The BRRR frontend is non-custodial, wallet-driven, and fully transparent.
              Governance actions always display raw and decoded calldata before execution.
            </p>
          </section>

          <section>
            <div className="h2">Conclusion</div>
            <p className="mt-2">
              BRRR demonstrates a sustainable model for decentralized on-chain entertainment
              where governance controls protocol behavior but never individual users.
            </p>
          </section>

        </article>
      </section>
    </main>
  );
}
