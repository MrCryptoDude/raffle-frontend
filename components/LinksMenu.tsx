"use client";

import * as React from "react";
import Link from "next/link";

type Item = {
  label: string;
  href: string;
  external?: boolean;
};

const ITEMS: Item[] = [
  { label: "Home", href: "/" },
  { label: "Governance", href: "/governance" },
  { label: "History", href: "/history" },
  {
    label: "Collection",
    href: "https://magiceden.io/ordinals/marketplace/ordinalprinters",
    external: true,
  },
  { label: "Discord", href: "https://discord.gg/WabmjKKx56", external: true },
  { label: "X", href: "https://x.com/OrdinalPrinter", external: true },
];


export function LinksMenu() {
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
      <button
        className="btn burger"
        type="button"
        aria-label="Links"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>

      {open && (
        <>
          <div className="linksBackdrop" onClick={() => setOpen(false)} />
          <div className="linksPopup panel">
            {ITEMS.map((it) =>
              it.external ? (
                <a
                  key={it.label}
                  className="linksItem"
                  href={it.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </a>
              ) : (
                <Link
                  key={it.label}
                  className="linksItem"
                  href={it.href}
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </Link>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
