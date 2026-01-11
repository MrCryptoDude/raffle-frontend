"use client";

import * as React from "react";

type SlotWinnersProps = {
  // increment this when a Finalized event happens for this raffle type
  trigger: number;

  // last winners (from getLastResult)
  lastRoundId?: bigint;
  w1?: `0x${string}`;
  w2?: `0x${string}`;
  w3?: `0x${string}`;
};

function shortAddr(a?: `0x${string}`) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isZeroAddr(a?: `0x${string}`) {
  if (!a) return true;
  return a.toLowerCase() === "0x0000000000000000000000000000000000000000";
}

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

export function SlotWinners(props: SlotWinnersProps) {
  const { trigger, lastRoundId, w1, w2, w3 } = props;

  const hasWinners =
    !isZeroAddr(w1) || !isZeroAddr(w2) || !isZeroAddr(w3);

  // IMPORTANT:
  // Reels should NOT stop just because "last result exists".
  // They stop only for a few seconds after a Finalized trigger.
  const [locked, setLocked] = React.useState(false);
  const [blink, setBlink] = React.useState(false);

  React.useEffect(() => {
    // On first page load trigger will be 0. Do nothing.
    if (trigger <= 0) return;

    // Stop reels
    setLocked(true);

    // Blink 3x (your CSS already handles the effect)
    setBlink(true);
    const t1 = setTimeout(() => setBlink(false), 950);

    // Resume spinning after a few seconds
    const t2 = setTimeout(() => setLocked(false), 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [trigger]);

  return (
    <div className="slotSection">
      <div className={`reelBox ${blink ? "blink" : ""}`}>
        <Reel locked={locked} />
        <Reel locked={locked} alt />
        <Reel locked={locked} alt2 />
      </div>

      <div className={`winnersScreen ${hasWinners ? "winnersOn" : ""}`}>
        <div className="wTitle">
          {hasWinners
            ? `WINNERS!${lastRoundId ? ` (R${lastRoundId.toString()})` : ""}`
            : "WINNERS! (NOT DRAWN YET)"}
        </div>

        <div className="wLine">1) {shortAddr(!isZeroAddr(w1) ? w1 : undefined)}</div>
        <div className="wLine">2) {shortAddr(!isZeroAddr(w2) ? w2 : undefined)}</div>
        <div className="wLine">3) {shortAddr(!isZeroAddr(w3) ? w3 : undefined)}</div>
      </div>
    </div>
  );
}
