"use client";

import * as React from "react";
import Link from "next/link";

const CATEGORIES = [
  {
    id: "raffle",
    icon: "🎰",
    title: "RAFFLE MANAGER",
    description: "Reset stuck raffles, refund players, and start new rounds",
    examples: ["Reset stuck Small raffle", "Refund Round #5 participants", "Update Chainlink forwarder"],
    color: "rgba(255,200,100,0.9)",
    href: "/governance/create/raffle",
  },
  {
    id: "lp",
    icon: "💰",
    title: "COMMUNITY LP",
    description: "Deploy, manage, and collect fees from a DAO-owned liquidity pool",
    examples: ["Add WETH/BRRR liquidity", "Collect LP trading fees", "Remove liquidity"],
    color: "rgba(100,200,255,0.9)",
    href: "/governance/create/lp",
  },
  {
    id: "signal",
    icon: "📢",
    title: "SIGNAL PROPOSAL",
    description: "Discussion-only proposals to gauge community sentiment",
    examples: ["Temperature check on new feature", "Community feedback request", "Non-binding poll"],
    color: "rgba(180,150,255,0.9)",
    href: "/governance/create/signal",
  },
];

export default function CreateProposalPage() {
  return (
    <main className="screen">
      {/* Header */}
      <section style={{
        padding: "32px 24px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 16,
        border: "1px solid rgba(0,255,140,0.15)",
        textAlign: "center",
      }}>
        <Link href="/governance" style={{ fontSize: 13, color: "rgba(0,255,140,0.7)", textDecoration: "none" }}>
          ← Back to Governance
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgba(0,255,140,0.95)", marginTop: 16 }}>
          📝 CREATE PROPOSAL
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
          Choose what type of proposal you want to create
        </p>
      </section>

      {/* Category Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 20,
        marginTop: 24,
      }}>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={cat.href}
            style={{
              display: "block",
              padding: 28,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 16,
              border: `1px solid ${cat.color}30`,
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${cat.color}60`;
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = `0 8px 32px ${cat.color}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${cat.color}30`;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Icon & Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <span style={{ fontSize: 40 }}>{cat.icon}</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: cat.color }}>
                  {cat.title}
                </h2>
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 20 }}>
              {cat.description}
            </p>

            {/* Examples */}
            <div style={{
              padding: 14,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                EXAMPLES:
              </p>
              {cat.examples.map((ex, i) => (
                <p key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                  • {ex}
                </p>
              ))}
            </div>

            {/* Arrow */}
            <div style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "flex-end",
            }}>
              <span style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: `${cat.color}15`,
                color: cat.color,
                fontSize: 13,
                fontWeight: 700,
              }}>
                Select →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: 32,
        padding: 20,
        background: "rgba(0,0,0,0.3)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 12 }}>
          💡 How Governance Works
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,255,140,0.9)" }}>1. Create</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              Submit your proposal with required BRRR tokens
            </p>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,255,140,0.9)" }}>2. Vote</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              BRRR holders vote FOR, AGAINST, or ABSTAIN
            </p>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,255,140,0.9)" }}>3. Queue</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              Passed proposals enter 24h timelock
            </p>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,255,140,0.9)" }}>4. Execute</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              Anyone can execute after timelock
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
