"use client";

import * as React from "react";

const SYMBOLS = ["₿", "Ξ", "◎", "⬡", "✦", "¤", "⟠", "⚡"];

function Reel({
  locked,
  alt,
  alt2,
}: {
  locked: boolean;
  alt?: boolean;
  alt2?: boolean;
}) {
  return (
    <div className={`reel ${locked ? "reelLocked" : ""}`}>
      <div className={`reelTrack ${alt ? "alt" : ""} ${alt2 ? "alt2" : ""}`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="sym">
            {SYMBOLS[i % SYMBOLS.length]}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevealSlot({
  spinning = true,
  blink = false,
  title = "REVEAL",
  subtitle,
}: {
  spinning?: boolean;
  blink?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const locked = !spinning;

  return (
    <div className="slotSection">
      <div className={`reelBox ${blink ? "blink" : ""}`}>
        <Reel locked={locked} />
        <Reel locked={locked} alt />
        <Reel locked={locked} alt2 />
      </div>

      <div className="winnersScreen winnersOn">
        <div className="wTitle">{title}</div>
        {subtitle ? <div className="wLine">{subtitle}</div> : null}
      </div>
    </div>
  );
}
