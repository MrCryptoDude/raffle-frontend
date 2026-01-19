"use client";

import * as React from "react";

type SlotWinnersProps = {
  // increment this when a Finalized event happens (or after a successful reveal)
  trigger: number;

  // optional label for the screen (e.g., "REVEAL COMPLETE", "ROUND FINALIZED")
  label?: string;
};

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

export function SlotWinners({ trigger, label }: SlotWinnersProps) {
  const [locked, setLocked] = React.useState(false);
  const [blink, setBlink] = React.useState(false);

  React.useEffect(() => {
    if (trigger <= 0) return;

    setLocked(true);
    setBlink(true);

    const t1 = setTimeout(() => setBlink(false), 950);
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

      <div className="winnersScreen winnersOn">
        <div className="wTitle">{label ?? "DRAW COMPLETE"}</div>
        <div className="wLine">
          Winners are published in <span className="font-semibold">History</span>.
        </div>
        <div className="wLine">If you played, press REVEAL to settle and see if you won.</div>
      </div>
    </div>
  );
}
