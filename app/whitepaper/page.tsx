"use client";

import * as React from "react";
import Link from "next/link";

export default function WhitepaperPage() {
  return (
    <main className="screen">
      <style jsx>{`
        .wpHeader {
          text-align: center;
          padding: 32px 24px;
          border-bottom: 1px solid rgba(125,255,178,0.2);
        }
        .wpTitle {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(125,255,178,0.95);
        }
        .wpSubtitle {
          margin-top: 12px;
          font-size: 11px;
          letter-spacing: 0.15em;
          color: rgba(170,255,205,0.7);
        }
        .wpVersion {
          margin-top: 8px;
          font-size: 10px;
          color: rgba(170,255,205,0.5);
        }
        
        .wpBody {
          padding: 32px 24px;
        }
        
        .wpSection {
          margin-bottom: 40px;
        }
        .wpSection:last-child {
          margin-bottom: 0;
        }
        
        .wpSectionTitle {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(125,255,178,0.95);
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(125,255,178,0.15);
        }
        
        .wpParagraph {
          font-size: 13px;
          line-height: 1.9;
          color: rgba(200,255,222,0.9);
          margin-bottom: 16px;
        }
        .wpParagraph:last-child {
          margin-bottom: 0;
        }
        
        .wpHighlight {
          color: rgba(125,255,178,1);
          font-weight: 600;
        }
        
        .wpList {
          list-style: none;
          padding: 0;
          margin: 16px 0;
        }
        .wpListItem {
          position: relative;
          padding-left: 20px;
          margin-bottom: 10px;
          font-size: 12px;
          line-height: 1.7;
          color: rgba(200,255,222,0.85);
        }
        .wpListItem::before {
          content: "›";
          position: absolute;
          left: 0;
          color: rgba(125,255,178,0.8);
          font-weight: bold;
          font-size: 14px;
        }
        
        .wpCard {
          background: rgba(0,0,0,0.35);
          border: 2px solid rgba(125,255,178,0.2);
          padding: 20px;
          margin: 20px 0;
        }
        .wpCardTitle {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(125,255,178,0.7);
          margin-bottom: 12px;
        }
        .wpCode {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          line-height: 1.6;
          color: rgba(125,255,178,0.9);
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .wpGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin: 20px 0;
        }
        @media (max-width: 768px) {
          .wpGrid {
            grid-template-columns: 1fr;
          }
        }
        
        .wpTable {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin: 16px 0;
        }
        .wpTable th,
        .wpTable td {
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(125,255,178,0.15);
        }
        .wpTable th {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(125,255,178,0.8);
          background: rgba(0,0,0,0.3);
          font-size: 10px;
        }
        .wpTable td {
          color: rgba(200,255,222,0.85);
        }
        .wpTable tbody tr:hover td {
          background: rgba(125,255,178,0.04);
        }
        
        .wpTableWrap {
          overflow-x: auto;
          margin: 16px 0;
        }
        
        .wpBadge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          border: 1px solid rgba(125,255,178,0.4);
          background: rgba(125,255,178,0.08);
          color: rgba(125,255,178,0.9);
          margin-right: 8px;
          margin-bottom: 8px;
        }
        
        .wpToc {
          background: rgba(0,0,0,0.3);
          border: 2px solid rgba(125,255,178,0.15);
          padding: 20px 24px;
          margin-bottom: 32px;
        }
        .wpTocTitle {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(125,255,178,0.6);
          margin-bottom: 12px;
        }
        .wpTocList {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }
        .wpTocItem {
          font-size: 11px;
          color: rgba(200,255,222,0.7);
          text-decoration: none;
        }
        .wpTocItem:hover {
          color: rgba(125,255,178,0.9);
        }
        
        .wpBackLink {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(125,255,178,0.6);
          text-decoration: none;
          margin-top: 16px;
        }
        .wpBackLink:hover {
          color: rgba(125,255,178,0.9);
        }
      `}</style>

      <div className="panel">
        <div className="wpHeader">
          <div className="wpTitle">BRRR PROTOCOL</div>
          <div className="wpSubtitle">Technical Whitepaper</div>
          <div className="wpVersion">v1.0 • Base Mainnet • 2025</div>
          <Link href="/" className="wpBackLink">
            ← Back to Arcade
          </Link>
        </div>

        <div className="wpBody">
          {/* Table of Contents */}
          <div className="wpToc">
            <div className="wpTocTitle">Contents</div>
            <div className="wpTocList">
              <span className="wpTocItem">1. Abstract</span>
              <span className="wpTocItem">2. Design Goals</span>
              <span className="wpTocItem">3. Architecture</span>
              <span className="wpTocItem">4. Governance</span>
              <span className="wpTocItem">5. Protocol-Owned Liquidity</span>
              <span className="wpTocItem">6. Staking System</span>
              <span className="wpTocItem">7. Game Protocols</span>
              <span className="wpTocItem">8. Security</span>
            </div>
          </div>

          {/* Abstract */}
          <section className="wpSection">
            <div className="wpSectionTitle">1. Abstract</div>
            <p className="wpParagraph">
              BRRR is a fully decentralized, on-chain financial arcade deployed on Base. It combines
              protocol-owned liquidity (POL), DAO governance, and multiple revenue-generating game
              primitives into a single, composable ecosystem.
            </p>
            <p className="wpParagraph">
              The system follows a strict <span className="wpHighlight">Satoshi-style philosophy</span>:
              no privileged externally owned accounts (EOAs), no custodial control, and all sensitive
              actions executed exclusively through on-chain governance via a timelocked DAO.
            </p>
            <div style={{ marginTop: 16 }}>
              <span className="wpBadge">Non-Custodial</span>
              <span className="wpBadge">DAO Governed</span>
              <span className="wpBadge">Protocol-Owned Liquidity</span>
              <span className="wpBadge">Chainlink VRF</span>
            </div>
          </section>

          {/* Design Goals */}
          <section className="wpSection">
            <div className="wpSectionTitle">2. Design Goals</div>
            <div className="wpGrid">
              <div>
                <p className="wpParagraph" style={{ marginBottom: 12 }}>
                  <span className="wpHighlight">Core Principles</span>
                </p>
                <ul className="wpList">
                  <li className="wpListItem">No privileged EOAs (no admin wallets)</li>
                  <li className="wpListItem">On-chain governance for protocol actions</li>
                  <li className="wpListItem">Protocol-Owned Liquidity for fee capture</li>
                  <li className="wpListItem">User fund sovereignty guaranteed</li>
                  <li className="wpListItem">Composable, modular architecture</li>
                </ul>
              </div>
              <div className="wpCard">
                <div className="wpCardTitle">Core Invariant</div>
                <div className="wpCode">{`BRRR Token → Governor → Timelock → Contracts

Governance controls protocol config.
Governance CANNOT touch user funds.`}</div>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section className="wpSection">
            <div className="wpSectionTitle">3. System Architecture</div>
            <p className="wpParagraph">
              The BRRR ecosystem is composed of independent but interoperable modules:
            </p>
            <ul className="wpList">
              <li className="wpListItem"><span className="wpHighlight">BRRR Token</span> — ERC20Votes governance and staking token</li>
              <li className="wpListItem"><span className="wpHighlight">Governor</span> — OpenZeppelin Governor for proposals and voting</li>
              <li className="wpListItem"><span className="wpHighlight">Timelock</span> — Delayed execution of approved actions</li>
              <li className="wpListItem"><span className="wpHighlight">StakingRewards</span> — Dual-token reward distribution</li>
              <li className="wpListItem"><span className="wpHighlight">RaffleManager</span> — Multi-tier lottery protocol</li>
              <li className="wpListItem"><span className="wpHighlight">RpsManager</span> — Rock-Paper-Scissors vs house</li>
              <li className="wpListItem"><span className="wpHighlight">GasPredictionMarket</span> — L1 gas price betting</li>
            </ul>
            <div className="wpCard">
              <div className="wpCardTitle">Execution Flow</div>
              <div className="wpCode">{`1. User creates proposal with targets[], values[], calldatas[]
2. BRRR holders vote during voting period
3. If quorum met + majority FOR → queue to timelock
4. After 24h delay → execute with byte-exact calldata
5. Target contract state updated`}</div>
            </div>
          </section>

          {/* Governance */}
          <section className="wpSection">
            <div className="wpSectionTitle">4. Governance System</div>
            <div className="wpGrid">
              <div>
                <p className="wpParagraph" style={{ marginBottom: 12 }}>
                  <span className="wpHighlight">Governance CAN</span>
                </p>
                <ul className="wpList">
                  <li className="wpListItem">Manage protocol-owned liquidity positions</li>
                  <li className="wpListItem">Adjust fee parameters for future rounds</li>
                  <li className="wpListItem">Trigger emergency pauses if designed</li>
                  <li className="wpListItem">Upgrade contracts while preserving claims</li>
                </ul>
              </div>
              <div>
                <p className="wpParagraph" style={{ marginBottom: 12 }}>
                  <span className="wpHighlight">Governance CANNOT</span>
                </p>
                <ul className="wpList">
                  <li className="wpListItem">Withdraw or seize user funds</li>
                  <li className="wpListItem">Redirect user claims or payouts</li>
                  <li className="wpListItem">Force transfers from user balances</li>
                  <li className="wpListItem">Modify settled game outcomes</li>
                </ul>
              </div>
            </div>
          </section>

          {/* POL */}
          <section className="wpSection">
            <div className="wpSectionTitle">5. Protocol-Owned Liquidity</div>
            <p className="wpParagraph">
              LiquidityTreasury is owned by the Timelock and manages Uniswap V3 positions. Governance
              can mint new positions, collect trading fees, and rebalance as market conditions change.
              This creates sustainable protocol revenue independent of user activity.
            </p>
            <div className="wpCard">
              <div className="wpCardTitle">POL Operations</div>
              <div className="wpCode">{`mintPosition(token0, token1, tickLower, tickUpper, amount)
collectFees(tokenId) → USDC to StakingRewards
decreaseLiquidity(tokenId, liquidity)
rebalance() → adjust tick range`}</div>
            </div>
          </section>

          {/* Staking */}
          <section className="wpSection">
            <div className="wpSectionTitle">6. Staking System</div>
            <p className="wpParagraph">
              Users stake BRRR tokens to earn protocol revenues. The StakingRewards contract supports
              dual-token rewards (USDC + BRRR) distributed over 24-hour epochs. Revenue sources include
              raffle fees, RPS fees, prediction market fees, and POL trading fees.
            </p>
            <ul className="wpList">
              <li className="wpListItem">24-hour epochs for smooth reward distribution</li>
              <li className="wpListItem">Automatic epoch rollover via Chainlink Automation</li>
              <li className="wpListItem">Pro-rata distribution based on stake weight</li>
              <li className="wpListItem">No lock-up — withdraw anytime</li>
            </ul>
          </section>

          {/* Games */}
          <section className="wpSection">
            <div className="wpSectionTitle">7. Game Protocols</div>
            
            <p className="wpParagraph" style={{ marginBottom: 20 }}>
              <span className="wpHighlight">7.1 Raffle Protocol</span>
            </p>
            <p className="wpParagraph">
              Multi-tier lottery system where users purchase tickets with USDC. Each tier has defined
              pot thresholds, winner counts, and payout distributions. Winners are selected using
              Chainlink VRF for provable fairness.
            </p>
            <div className="wpTableWrap">
              <table className="wpTable">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Pot Size</th>
                    <th>Winners</th>
                    <th>1st Place</th>
                    <th>2nd Place</th>
                    <th>3rd Place</th>
                    <th>Stakers</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Small</td>
                    <td>$1,000</td>
                    <td>3</td>
                    <td>52%</td>
                    <td>31%</td>
                    <td>12%</td>
                    <td>5%</td>
                  </tr>
                  <tr>
                    <td>Medium</td>
                    <td>$10,000</td>
                    <td>10</td>
                    <td>48%</td>
                    <td>28%</td>
                    <td>14%</td>
                    <td>5%</td>
                  </tr>
                  <tr>
                    <td>Large</td>
                    <td>$100,000</td>
                    <td>25</td>
                    <td>45%</td>
                    <td>27%</td>
                    <td>18%</td>
                    <td>5%</td>
                  </tr>
                  <tr>
                    <td>Mega</td>
                    <td>$1,000,000</td>
                    <td>50</td>
                    <td>40%</td>
                    <td>22%</td>
                    <td>13%</td>
                    <td>5%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="wpParagraph" style={{ marginTop: 24, marginBottom: 20 }}>
              <span className="wpHighlight">7.2 Rock-Paper-Scissors</span>
            </p>
            <p className="wpParagraph">
              Players bet BRRR tokens against the house treasury. House moves are determined by Chainlink
              VRF after player commits. 1% fee on all bets distributed to stakers. House maintains
              treasury for payouts.
            </p>

            <p className="wpParagraph" style={{ marginTop: 24, marginBottom: 20 }}>
              <span className="wpHighlight">7.3 Gas Prediction Market</span>
            </p>
            <p className="wpParagraph">
              Pooled long/short betting on Ethereum L1 base fee. Rounds have fixed betting windows,
              strike prices set at round start, and settlements based on actual gas prices. Winners
              split the losing pool pro-rata.
            </p>
            <div className="wpCard">
              <div className="wpCardTitle">Round Lifecycle</div>
              <div className="wpCode">{`IDLE → First bet starts round
BETTING → Fixed block window for entries
WAITING → Oracle provides settlement price
SETTLED → Winners claim, round resets`}</div>
            </div>
          </section>

          {/* Security */}
          <section className="wpSection">
            <div className="wpSectionTitle">8. Security Considerations</div>
            <ul className="wpList">
              <li className="wpListItem">No EOAs with admin rights — all changes via governance</li>
              <li className="wpListItem">24-hour timelock delay for all sensitive operations</li>
              <li className="wpListItem">User funds isolated from governance control surface</li>
              <li className="wpListItem">Chainlink VRF for provably fair randomness</li>
              <li className="wpListItem">Chainlink Automation for trustless execution</li>
              <li className="wpListItem">Deterministic, auditable execution paths</li>
            </ul>
            <div style={{ marginTop: 24 }}>
              <span className="wpBadge">Audited Contracts</span>
              <span className="wpBadge">OpenZeppelin Standards</span>
              <span className="wpBadge">Chainlink Oracles</span>
            </div>
          </section>

          {/* Conclusion */}
          <section className="wpSection">
            <div className="wpSectionTitle">Conclusion</div>
            <p className="wpParagraph">
              BRRR Protocol demonstrates a decentralized on-chain arcade architecture where governance
              controls protocol behavior but never individual user funds. By combining strict governance
              constraints, protocol-owned liquidity, and modular game primitives, the system aims for
              sustainable, censorship-resistant on-chain entertainment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
