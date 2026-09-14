"use client";

import type { RpsChain } from "../lib/rpsChains";

/** Which chain a room lives on, readable at a glance. */
export function ChainBadge({ chain, size = "sm" }: { chain: RpsChain; size?: "sm" | "md" }) {
  const md = size === "md";
  return (
    <span
      title={chain.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: md ? "2px 8px" : "1px 6px",
        border: `1px solid ${chain.color}`,
        borderRadius: 6,
        color: chain.color,
        background: "rgba(0,0,0,0.35)",
        fontSize: md ? 11 : 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: chain.color }} />
      {chain.badge}
    </span>
  );
}
