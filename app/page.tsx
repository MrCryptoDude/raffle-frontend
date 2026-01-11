"use client";

import Link from "next/link";
import * as React from "react";

export default function HomePage() {
  const [muted, setMuted] = React.useState(true);

  return (
    <main className="screen">
      <section className="panel p-5 text-center">
        <div className="h1">MONEY PRINTER GO BRRR</div>
        <div className="muted text-[10px] mt-2">
          A MEME-DRIVEN RAFFLE ARCADE • WINNERS GET PAID • STAKERS GET THE BRRR CUT
        </div>
      </section>

      <section className="mt-5 panel p-5">
        <div className="videoFrame">
          <div className="videoBezel" />

          <video
            className="videoEl"
            src="/media/brrr.mp4"
            autoPlay
            loop
            playsInline
            muted={muted}
            controls={false}
          />

          <div className="videoOverlay" aria-hidden="true" />

          <button
            className="btn btnBlue videoSound"
            onClick={() => setMuted((m) => !m)}
            type="button"
          >
            {muted ? "SOUND: OFF" : "SOUND: ON"}
          </button>
        </div>

        <div className="mt-5 storyGrid">
          <div className="inset p-4">
            <div className="h2">THE POLICY</div>
            <div className="muted text-[11px] mt-2">
              THEY PRINT. PRICES GO UP. YOUR SAVINGS GO DOWN.
              <br />
              <br />
              WE DID THE ONLY RATIONAL THING:
              <br />
              WE TURNED IT INTO AN ARCADE GAME.
            </div>
          </div>

          <div className="inset p-4">
            <div className="h2">HOW IT WORKS</div>
            <div className="muted text-[11px] mt-2">
              BUY TICKETS WITH USDC.
              <br />
              THE POT FILLS.
              <br />
              WINNERS TAKE 50/30/10.
              <br />
              <br />
              AND 10% GOES TO STAKERS — THE BRRR CUT.
            </div>
          </div>

          <div className="inset p-4">
            <div className="h2">THE VIBE</div>
            <div className="muted text-[11px] mt-2">
              NO ROADMAP POETRY.
              <br />
              NO “UTILITY” PARAGRAPHS.
              <br />
              <br />
              JUST MATH, MEMES, AND A VERY TIRED PRINTER.
            </div>
          </div>
        </div>

        <div className="mt-5 ctaRow">
          <Link className="btn btnGold ctaBtn" href="/play">
            PLAY THE RAFFLE
          </Link>

          <Link className="btn btnMint ctaBtn" href="/stake">
            STAKE & EARN
          </Link>
        </div>

        <div className="muted text-[10px] mt-4 text-center">
          TIP: IF YOUR WALLET IS ON THE WRONG NETWORK, SWITCH TO BASE SEPOLIA.
        </div>
      </section>
    </main>
  );
}
