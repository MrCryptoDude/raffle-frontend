"use client";

import * as React from "react";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMatrixBlock(seed: number, rows = 12, cols = 22) {
  const rnd = mulberry32(seed);
  const alphabet = "0123456789ABCDEF$#%&@+*";
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let s = "";
    for (let c = 0; c < cols; c++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    lines.push(s);
  }
  return lines;
}

const NAMES: Record<number, string> = { 1: "ROCK", 2: "PAPER", 3: "SCISSORS" };

/**
 * The glowing matrix move icon from the original arena.
 *
 * `move` uses the contract's numbering: 1 rock, 2 paper, 3 scissors. Callers
 * needs `matrixFloat` / `matrixFloatSlow` keyframes on the page.
 */
export function MatrixRpsIcon({
  move,
  tag,
  isRevealing,
  seed,
}: {
  move: number;
  tag: string;
  isRevealing: boolean;
  seed: number;
}) {
  const uid = React.useId().replace(/:/g, "");
  const clipId = `clip_${uid}`;
  const glowId = `glow_${uid}`;
  const scanId = `scan_${uid}`;

  const shape = React.useMemo(() => {
    if (move === 1) {
      return <path d="M22 72 L34 34 L54 18 L78 26 L96 52 L84 92 L54 104 L30 94 Z" />;
    }
    if (move === 2) {
      return (
        <>
          <path d="M30 14 H74 L92 32 V106 H30 Z" />
          <path d="M74 14 V32 H92" />
          <path d="M40 46 H82" />
          <path d="M40 58 H82" />
          <path d="M40 70 H78" />
          <path d="M40 82 H72" />
        </>
      );
    }
    return (
      <>
        <path d="M44 26 a12 12 0 1 0 0.1 0 Z" />
        <path d="M78 26 a12 12 0 1 0 0.1 0 Z" />
        <path d="M50 36 L70 62" />
        <path d="M72 36 L52 62" />
        <path d="M60 60 L32 106" />
        <path d="M60 60 L88 106" />
      </>
    );
  }, [move]);

  const lines = React.useMemo(() => makeMatrixBlock(seed, 12, 22), [seed]);

  return (
    <svg
      className="rpsIcon"
      viewBox="0 0 120 120"
      style={{ display: "block", filter: `url(#${glowId})` }}
      aria-label={`${tag} ${NAMES[move] ?? ""}`}
    >
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0.95 0"
            result="greenGlow"
          />
          <feMerge>
            <feMergeNode in="greenGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <clipPath id={clipId}>{move === 2 ? <path d="M30 14 H74 L92 32 V106 H30 Z" /> : shape}</clipPath>

        <pattern id={scanId} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0H6" stroke="rgba(0,255,140,0.12)" strokeWidth="1" />
        </pattern>
      </defs>

      <g fill="none" stroke="rgba(0,255,140,0.95)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {shape}
      </g>
      <g fill="none" stroke="rgba(0,255,140,0.35)" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round">
        {shape}
      </g>

      <g clipPath={`url(#${clipId})`} opacity={isRevealing ? 1 : 0.82}>
        <rect x="0" y="0" width="120" height="120" fill="rgba(0,0,0,0.25)" />
        <g className={isRevealing ? "matrixFloat" : "matrixFloatSlow"}>
          {lines.map((ln, i) => (
            <text
              key={i}
              x={-6}
              y={18 + i * 9}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
              fontSize="10"
              fill="rgba(0,255,140,0.9)"
              letterSpacing="1.5"
            >
              {ln}
            </text>
          ))}
        </g>
        <rect x="0" y="0" width="120" height="120" fill={`url(#${scanId})`} opacity="0.6" />
        <rect x="0" y="0" width="120" height="120" fill="rgba(0,0,0,0.12)" />
      </g>

      <text x={6} y={112} fontFamily="ui-monospace, monospace" fontSize="10" fill="rgba(0,255,140,0.75)" letterSpacing="1.2">
        {tag}
      </text>
    </svg>
  );
}
