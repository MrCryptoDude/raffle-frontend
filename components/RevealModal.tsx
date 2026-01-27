"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { USDC_DECIMALS } from "../lib/addresses";
import { RevealSlot } from "./RevealSlot";

type Stage = "idle" | "spinning" | "mining" | "done" | "error";

function DecryptLine({
  text,
  active,
  speedMs = 22,
}: {
  text: string;
  active: boolean;
  speedMs?: number;
}) {
  const [out, setOut] = React.useState(text);

  React.useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%*+?";
    let i = 0;

    const tick = () => {
      // progressively "locks in" the real text from left to right
      const locked = text.slice(0, i);
      const restLen = Math.max(0, text.length - i);

      const scrambled =
        locked +
        Array.from({ length: restLen })
          .map(() => chars[Math.floor(Math.random() * chars.length)])
          .join("");

      setOut(scrambled);
      i = Math.min(text.length, i + 1);
    };

    tick();
    const t = setInterval(tick, speedMs);

    return () => clearInterval(t);
  }, [text, active, speedMs]);

  return (
    <div
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        letterSpacing: 1,
      }}
      className="muted text-[10px]"
    >
      {out}
    </div>
  );
}

function ScanBar({ active }: { active: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        height: 10,
        borderRadius: 999,
        overflow: "hidden",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "35%",
          transform: active ? "translateX(185%)" : "translateX(-10%)",
          transition: active ? "transform 900ms linear" : "none",
          background: "rgba(255,255,255,0.18)",
          filter: "blur(0.2px)",
        }}
      />
    </div>
  );
}





export function RevealModal({
  open,
  stage,
  onClose,
  error,
  wonDelta,
}: {
  open: boolean;
  stage: Stage;
  onClose: () => void;
  error: string | null;
  wonDelta: bigint;
}) {
  if (!open) return null;

  const isBusy = stage === "spinning" || stage === "mining";
  const won = wonDelta > 0n;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => {
        // click outside closes only if not busy
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="panel max-w-md w-full p-5">
        <div className="flex items-center justify-between">
          <div className="h2">REVEAL</div>
          <button className="btn btnMint" onClick={onClose} disabled={isBusy}>
            CLOSE
          </button>
        </div>

        <div className="mt-4 inset statBox">
          <div className="muted text-[10px]">STATUS</div>
          <div className="mt-2">
            {stage === "spinning" && (
              <>
                <DecryptLine text="DECRYPTING ROUND RESULT…" active />
                <div className="mt-2">
                  <ScanBar active />
                </div>
                <div className="mt-2">
                  <DecryptLine text="DERIVING SETTLEMENT PROOF…" active />
                </div>
              </>
            )}

            {stage === "mining" && (
              <>
                <DecryptLine text="CONFIRM IN WALLET…" active />
                <div className="mt-2">
                  <ScanBar active />
                </div>
                <div className="mt-2">
                  <DecryptLine text="WAITING FOR TX CONFIRMATION…" active />
                </div>
              </>
            )}

            {stage === "done" && (
              <>
                <div className="muted text-[10px]">REVEAL COMPLETE</div>
                <div className="h1 mt-2">
                  {won
                    ? `YOU WON ${formatUnits(wonDelta, USDC_DECIMALS)} USDC`
                    : "NO WIN THIS ROUND"}
                </div>
                <div className="muted text-[10px] mt-2">
                  If you won, your winnings are now credited. Use the CLAIM button to withdraw.
                </div>
              </>
            )}

            {stage === "error" && (
              <>
                <div className="danger text-[10px]">REVEAL FAILED</div>
                <div className="muted text-[10px] mt-2">
                  {error ?? "Unknown error"}
                </div>
              </>
            )}
          </div>
        </div>

        
      </div>
    </div>
  );
}
