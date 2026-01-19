"use client";

import * as React from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";

import { addresses, USDC_DECIMALS, REQUIRED_CHAIN_ID } from "../../lib/addresses";
import { raffleManagerAbi } from "../../lib/abis";

type RType = 0 | 1 | 2 | 3;

function shortAddr(a?: `0x${string}`) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function HistoryPage() {
  const [rType, setRType] = React.useState<RType>(0);
  const [offset, setOffset] = React.useState(0n);
  const limit = 10n;

  const { data, isLoading, refetch } = useReadContract({
    chainId: REQUIRED_CHAIN_ID,
    abi: raffleManagerAbi,
    address: addresses.manager,
    functionName: "getHistory",
    args: [rType, offset, limit],
    query: { refetchInterval: 4000 },
  });

  const rows = (data ?? []) as any[];

  function loadMore() {
    setOffset((o) => o + limit);
  }

  return (
    <main className="screen">
      <div className="panel px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="h2">HISTORY</div>
            <div className="muted text-[10px] mt-1">
              Winners + payouts by raffle size and round.
            </div>
          </div>

          <div className="flex gap-2">
            <select
              className="input"
              value={rType}
              onChange={(e) => {
                setOffset(0n);
                setRType(Number(e.target.value) as RType);
                setTimeout(() => refetch(), 0);
              }}
            >
              <option value={0}>SMALL</option>
              <option value={1}>MEDIUM</option>
              <option value={2}>LARGE</option>
              <option value={3}>MEGA</option>
            </select>
            <button className="btn btnMint" onClick={() => refetch()}>
              REFRESH
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading && (
          <div className="panel px-5 py-3">
            <div className="muted text-[10px]">Loading…</div>
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="panel px-5 py-3">
            <div className="muted text-[10px]">No history yet.</div>
          </div>
        )}

        {rows.map((r, idx) => {
          // Your contract Result struct:
          // roundId, requestId, w1,w2,w3,p1,p2,p3, runnerEach, winnersTotal, stakersPaid, timestamp
          const roundId = r.roundId as bigint;
          const w1 = r.w1 as `0x${string}`;
          const w2 = r.w2 as `0x${string}`;
          const w3 = r.w3 as `0x${string}`;
          const p1 = r.p1 as bigint;
          const p2 = r.p2 as bigint;
          const p3 = r.p3 as bigint;
          const runnerEach = r.runnerEach as bigint;
          const winnersTotal = Number(r.winnersTotal as bigint);
          const stakersPaid = r.stakersPaid as bigint;
          const ts = Number(r.timestamp as bigint) * 1000;

          return (
            <div className="panel px-5 py-4" key={`${offset.toString()}-${idx}`}>
              <div className="flex items-center justify-between">
                <div className="h2">R{roundId.toString()}</div>
                <div className="muted text-[10px]">
                  {Number.isFinite(ts) ? new Date(ts).toLocaleString() : "—"}
                </div>
              </div>

              <div className="mt-3 inset statBox">
                <div className="muted text-[10px]">TOP 3</div>
                <div className="muted text-[10px] mt-2">
                  1ST: {shortAddr(w1)} • {formatUnits(p1, USDC_DECIMALS)} USDC
                </div>
                <div className="muted text-[10px] mt-1">
                  2ND: {shortAddr(w2)} • {formatUnits(p2, USDC_DECIMALS)} USDC
                </div>
                <div className="muted text-[10px] mt-1">
                  3RD: {shortAddr(w3)} • {formatUnits(p3, USDC_DECIMALS)} USDC
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="inset statBox">
                  <div className="muted text-[10px]">RUNNER EACH</div>
                  <div className="h2">{formatUnits(runnerEach, USDC_DECIMALS)} USDC</div>
                </div>
                <div className="inset statBox">
                  <div className="muted text-[10px]">WINNERS</div>
                  <div className="h2">{winnersTotal}</div>
                </div>
              </div>

              <div className="mt-3 inset statBox">
                <div className="muted text-[10px]">STAKERS PAID</div>
                <div className="h2">{formatUnits(stakersPaid, USDC_DECIMALS)} USDC</div>
              </div>
            </div>
          );
        })}

        <div className="panel px-5 py-3 flex justify-center">
          <button className="btn btnGold" onClick={loadMore}>
            LOAD MORE
          </button>
        </div>
      </div>
    </main>
  );
}
