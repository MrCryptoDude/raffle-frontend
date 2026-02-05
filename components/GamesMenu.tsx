"use client";

import * as React from "react";
import Link from "next/link";

export function GamesMenu() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="linksWrap">
      <button className="btn btnBlue" onClick={() => setOpen((v) => !v)}>
        GAMES
      </button>

      {open && (
        <>
          <div className="linksBackdrop" onClick={() => setOpen(false)} />
          <div className="linksPopup" style={{ left: "50%", transform: "translateX(-50%)" }}>
            <Link className="linksItem" href="/play" onClick={() => setOpen(false)}>
              RAFFLE
            </Link>
            <Link className="linksItem" href="/rps" onClick={() => setOpen(false)}>
              ROCK PAPER SCISSORS
            </Link>
            <Link className="linksItem" href="/gas" onClick={() => setOpen(false)}>
              GAS PREDICTION
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
