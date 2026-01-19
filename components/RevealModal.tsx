"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { USDC_DECIMALS } from "../lib/addresses";
import { RevealSlot } from "./RevealSlot";

type Stage = "idle" | "spinning" | "mining" | "done" | "error";

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
                <div className="muted text-[10px]">SPINNING…</div>
                <div className="mt-2">
                  <RevealSlot spinning />
                </div>
              </>
            )}

            {stage === "mining" && (
              <>
                <div className="muted text-[10px]">CONFIRM IN WALLET…</div>
                <div className="muted text-[10px] mt-1">
                  WAITING FOR TX CONFIRMATION…
                </div>
                <div className="mt-2">
                  <RevealSlot spinning />
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

        <div className="mt-4 muted text-[10px]">
          Reveal is only enabled if you participated and the VRF word is ready for settlement.
        </div>
      </div>
    </div>
  );
}
