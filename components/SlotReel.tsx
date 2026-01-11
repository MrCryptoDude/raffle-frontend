"use client";

import * as React from "react";

const SYMBOLS = ["BTC", "SOL", "ETH", "LINK", "AERO"];

export function SlotReel({
  spinning,
}: {
  spinning: boolean;
}) {
  const items = [...SYMBOLS, ...SYMBOLS]; // doubled for smooth loop

  return (
    <div className={`slotWindow ${spinning ? "" : "slotStop"}`}>
      <div className="slotMask">
        <div className="slotReel">
          {items.map((s, i) => (
            <div key={`${s}-${i}`} className="slotItem">
              {s}
            </div>
          ))}
        </div>
      </div>

      <div className="slotGlow" />
    </div>
  );
}
