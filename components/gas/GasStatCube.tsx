'use client';

import React from 'react';
import { formatUnits } from 'viem';

function trimDecimals(v: string, max = 4) {
  if (!v.includes('.')) return v;
  const [a, b] = v.split('.');
  const bb = b.slice(0, max).replace(/0+$/, ''); // trim trailing zeros
  return bb.length ? `${a}.${bb}` : a;
}

function fmtGwei(wei?: bigint) {
  if (wei === undefined) return '—';
  // basefee is safely small enough to format as string; formatUnits keeps precision
  return trimDecimals(formatUnits(wei, 9), 4);
}

type Props = {
  currentBaseFeeWei?: bigint;
  avgBaseFeeWei?: bigint;
  obsCount?: number;
};

export default function GasStatCube({ currentBaseFeeWei, avgBaseFeeWei, obsCount }: Props) {
  const cur = fmtGwei(currentBaseFeeWei);
  const avg = fmtGwei(avgBaseFeeWei);
  const count = obsCount ?? 0;

  return (
    <div className="relative w-full h-full min-h-[260px] rounded-2xl border border-emerald-500/25 bg-black/35 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_30px_90px_rgba(0,0,0,0.65)] overflow-hidden">
      {/* soft glow */}
      <div className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_55%)]" />

      {/* faux 3D frame */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-emerald-400/10" />
      <div className="pointer-events-none absolute -right-10 top-6 bottom-6 w-20 bg-emerald-500/10 blur-xl" />
      <div className="pointer-events-none absolute left-6 right-6 -bottom-10 h-20 bg-emerald-500/10 blur-xl" />

      <div className="relative h-full p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-widest text-emerald-200/80">PRICE OF LATEST GAS BLOCK</div>
          <div className="text-xs text-emerald-200/50">avg uses {count}/20 samples</div>
        </div>

        {/* Two-stat layout */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-emerald-500/15 bg-black/35 p-4">
            <div className="text-xs font-semibold tracking-widest text-emerald-200/70">CURRENT</div>
            <div className="mt-2 leading-none">
              <div className="font-extrabold tabular-nums text-emerald-200 text-[clamp(28px,3.6vw,56px)]">
                {cur}
              </div>
              <div className="mt-2 font-bold text-emerald-200/80 text-[clamp(18px,2.2vw,34px)]">
                gwei
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/15 bg-black/25 p-4">
            <div className="text-xs font-semibold tracking-widest text-emerald-200/70">AVG (THIS ROUND)</div>
            <div className="mt-2 leading-none">
              <div className="font-extrabold tabular-nums text-emerald-200/90 text-[clamp(22px,3.1vw,44px)]">
                {avg}
              </div>
              <div className="mt-2 font-bold text-emerald-200/70 text-[clamp(16px,2vw,28px)]">
                gwei
              </div>
            </div>
          </div>
        </div>

        {/* subtle “cube face” lines */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute left-6 right-6 top-16 h-px bg-emerald-500/10" />
          <div className="absolute left-6 right-6 top-[58%] h-px bg-emerald-500/10" />
          <div className="absolute top-16 bottom-6 left-6 w-px bg-emerald-500/10" />
          <div className="absolute top-16 bottom-6 right-6 w-px bg-emerald-500/10" />
        </div>
      </div>
    </div>
  );
}
