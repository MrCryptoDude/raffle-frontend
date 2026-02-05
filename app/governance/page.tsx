"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import { useGovernanceProposals } from "@/app/hooks/useGovernanceProposals";

type ListMode = "live" | "canceled" | "finished" | "queued" | "all";

function stateLabel(state?: number) {
  switch (state) {
    case 0: return "Pending";
    case 1: return "Active";
    case 2: return "Canceled";
    case 3: return "Defeated";
    case 4: return "Succeeded";
    case 5: return "Queued";
    case 6: return "Expired";
    case 7: return "Executed";
    default: return `Unknown (${state ?? "?"})`;
  }
}

function isFinished(state?: number) {
  // "Finished" = terminal outcomes (custom UX definition)
  return state === 3 || state === 6 || state === 7; // Defeated, Expired, Executed
}

function matchesMode(state: number | undefined, mode: ListMode) {
  if (mode === "all") return true;

  // if we don't know state yet, still show it so list isn't empty
  if (state === undefined) return true;

  if (mode === "live") return state === 0 || state === 1;         // Pending/Active
  if (mode === "canceled") return state === 2;                    // Canceled
  if (mode === "queued") return state === 5;                      // Queued
  if (mode === "finished") return isFinished(state);              // Defeated/Expired/Executed

  return true;
}

function fmtVotes(x?: bigint) {
  if (x === undefined) return "—";
  return formatUnits(x, 18);
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`badge ${active ? "border-[rgba(180,255,125,0.85)]" : ""}`}
      style={{ padding: "6px 8px" }}
    >
      {label}
    </button>
  );
}

function ProposalListItem({
  proposalId,
  title,
  state,
  selected,
  onSelect,
}: {
  proposalId: bigint;
  title: string;
  state?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="inset w-full text-left p-3 hover:bg-[rgba(125,255,178,0.06)]"
      style={{
        borderWidth: 2,
        borderColor: selected ? "rgba(180,255,125,0.85)" : "rgba(125,255,178,0.22)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="tiny muted truncate" style={{ maxWidth: 150 }}>
          #{proposalId.toString()}
        </div>
        <div className="tiny muted">{stateLabel(state)}</div>
      </div>
      <div className="mt-1 h2 truncate">{title}</div>
    </button>
  );
}

export default function GovernancePage() {
  const governor = addresses.governor;

  const { data, loading, error } = useGovernanceProposals({ fromBlock: 0n, limit: 200 });

  // Selected proposal
  const [selectedId, setSelectedId] = React.useState<bigint | null>(null);

  // Left column mode (what the user chose: live/canceled/finished/queued/all)
  const [mode, setMode] = React.useState<ListMode>("live");

  // Cache proposal states so we can categorize (live/canceled/finished/queued)
  const [stateCache, setStateCache] = React.useState<Record<string, number>>({});

  // Default selection
  React.useEffect(() => {
    if (!selectedId && data.length > 0) setSelectedId(data[0].proposalId);
  }, [data, selectedId]);

  const selected = React.useMemo(() => {
    if (!selectedId) return data[0] ?? null;
    return data.find((p) => p.proposalId === selectedId) ?? (data[0] ?? null);
  }, [data, selectedId]);

  // Prefetch states for first N proposals (enough to power left categorization)
  function StatePrefetch({ proposalId }: { proposalId: bigint }) {
    const st = useReadContract({
      address: governor,
      abi: governorAbi,
      functionName: "state",
      args: [proposalId],
      query: { enabled: !!governor },
    });

    React.useEffect(() => {
      const v = st.data as unknown as number | undefined;
      if (v === undefined) return;
      setStateCache((prev) => {
        const k = proposalId.toString();
        if (prev[k] === v) return prev;
        return { ...prev, [k]: v };
      });
    }, [st.data, proposalId]);

    return null;
  }

  const filtered = React.useMemo(() => {
    return data.filter((p) => matchesMode(stateCache[p.proposalId.toString()], mode));
  }, [data, mode, stateCache]);

  // Selected proposal reads (middle/right panels)
  const selectedState = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "state",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected },
  });

  const selectedVotes = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "proposalVotes",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected },
  });

  const selectedSnapshot = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "proposalSnapshot",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected },
  });

  const selectedDeadline = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "proposalDeadline",
    args: selected ? [selected.proposalId] : undefined,
    query: { enabled: !!governor && !!selected },
  });

  const stNum = selectedState.data as unknown as number | undefined;
  const votes = selectedVotes.data as unknown as
    | { againstVotes: bigint; forVotes: bigint; abstainVotes: bigint }
    | undefined;

  const snapshot = selectedSnapshot.data as unknown as bigint | undefined;
  const deadline = selectedDeadline.data as unknown as bigint | undefined;

  const quorum = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "quorum",
    args: snapshot !== undefined ? [snapshot] : undefined,
    query: { enabled: !!governor && snapshot !== undefined },
  });
  const quorumAtSnapshot = quorum.data as unknown as bigint | undefined;

  // Right panel primary button label (state-driven)
  const primaryActionLabel =
    stNum === 4 ? "QUEUE PROPOSAL" :
    stNum === 5 ? "EXECUTE PROPOSAL" :
    "ACTION UNAVAILABLE";

  const primaryDisabled = !(stNum === 4 || stNum === 5);

  return (
    <main className="screen">
      <section className="panel p-5 text-center">
        <div className="h1">GOVERNANCE</div>
        <div className="muted text-[10px] mt-2">
          BRRRGovernor • Base Sepolia 84532 • <span className="font-mono">{governor}</span>
        </div>
      </section>

      <section className="mt-5 panel p-5">
        {/* FORCE HORIZONTAL 3-COLUMN LAYOUT */}
        <div className="govWrap">
          {/* LEFT (small) */}
          <div className="inset p-3 govLeft">
            <div className="flex items-center justify-between">
              <div className="h2">PROPOSALS</div>
              <a className="tiny underline muted" href="/governance/create">
                CREATE
              </a>
            </div>

            {/* What user chose: Live / Canceled / Finished / Queued / All */}
            <div className="mt-3 flex flex-wrap gap-2">
              <ModeButton label="LIVE" active={mode === "live"} onClick={() => setMode("live")} />
              <ModeButton label="CANCELED" active={mode === "canceled"} onClick={() => setMode("canceled")} />
              <ModeButton label="FINISHED" active={mode === "finished"} onClick={() => setMode("finished")} />
              <ModeButton label="QUEUED" active={mode === "queued"} onClick={() => setMode("queued")} />
              <ModeButton label="ALL" active={mode === "all"} onClick={() => setMode("all")} />
            </div>

            <div className="muted tiny mt-3">Scroll • click to view</div>

            <div className="mt-3 govList">
              {loading && <div className="muted text-[11px]">Loading proposals…</div>}
              {error && <div className="muted text-[11px] danger">{error}</div>}
              {!loading && !error && filtered.length === 0 && (
                <div className="muted text-[11px]">No proposals in this category.</div>
              )}

              {/* Prefetch state for first 75 proposals so categorization works */}
              {data.slice(0, 75).map((p) => (
                <StatePrefetch key={`prefetch-${p.proposalId.toString()}`} proposalId={p.proposalId} />
              ))}

              <div className="grid gap-2">
                {filtered.map((p) => (
                  <ProposalListItem
                    key={p.proposalId.toString()}
                    proposalId={p.proposalId}
                    title={p.title}
                    state={stateCache[p.proposalId.toString()]}
                    selected={selected?.proposalId === p.proposalId}
                    onSelect={() => setSelectedId(p.proposalId)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* MIDDLE (big) */}
          <div className="inset p-4 govMid">
            <div className="flex items-center justify-between gap-3">
              <div className="h2">PROPOSAL DETAILS</div>
              <div className="badge">{selected ? `#${selected.proposalId.toString()}` : "—"}</div>
            </div>

            <div className="mt-3 grid gap-3">
              <div className="panel p-3">
                <div className="muted tiny">CREATOR</div>
                <div className="font-mono text-[10px] truncate">{selected?.proposer ?? "—"}</div>
              </div>

              <div className="panel p-3">
                <div className="muted tiny">DETAILS</div>
                <div className="text-[11px] mt-2 whitespace-pre-wrap">{selected?.description ?? "—"}</div>
              </div>

              <div className="panel p-3">
                <div className="muted tiny">ON-CHAIN META</div>
                <div className="mt-2 grid gap-2 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="muted">STATE</span>
                    <span className="font-mono">{stateLabel(stNum)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="muted">SNAPSHOT</span>
                    <span className="font-mono">{snapshot?.toString() ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="muted">DEADLINE</span>
                    <span className="font-mono">{deadline?.toString() ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="muted">QUORUM @ SNAP</span>
                    <span className="font-mono">{quorumAtSnapshot ? fmtVotes(quorumAtSnapshot) : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Placeholder: next step we show targets/values/calldatas EXACT from ProposalCreated */}
              <div className="panel p-3">
                <div className="muted tiny">TARGETS[] / VALUES[] / CALLDATA[]</div>
                <div className="muted text-[11px] mt-2">
                  Next: show byte-exact targets/values/calldatas (raw toggle + decode).
                </div>
              </div>

              <div className="panel p-3">
                <div className="muted tiny">COMMENTS</div>
                <div className="muted text-[11px] mt-2">
                  Not on-chain in OZ Governor. Optional offchain thread later.
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT (small) */}
          <div className="inset p-3 govRight">
            <div className="h2">VOTE</div>

            <div className="mt-3 grid gap-2">
              <button className="btn btnMint" type="button" disabled={stNum !== 1}>
                YES
              </button>
              <button className="btn btnGold" type="button" disabled={stNum !== 1}>
                NO
              </button>
              <button className="btn" type="button" disabled={stNum !== 1}>
                ABSTAIN
              </button>
            </div>

            <div className="mt-4 panel p-3">
              <div className="muted tiny">VOTE TOTALS</div>
              <div className="mt-2 grid gap-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="muted">FOR</span>
                  <span className="font-mono">{fmtVotes(votes?.forVotes)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="muted">AGAINST</span>
                  <span className="font-mono">{fmtVotes(votes?.againstVotes)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="muted">ABSTAIN</span>
                  <span className="font-mono">{fmtVotes(votes?.abstainVotes)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button className="btn btnBlue w-full" type="button" disabled={primaryDisabled}>
                {primaryActionLabel}
              </button>
              <div className="muted text-[10px] mt-2">
                {stNum === 4
                  ? "Succeeded → Queue via Timelock"
                  : stNum === 5
                  ? "Queued → Execute after delay"
                  : stNum === 1
                  ? "Active → Vote"
                  : "No action available in this state."}
              </div>
            </div>
          </div>
        </div>

        {/* Hard CSS (not Tailwind-dependent) */}
        <style jsx>{`
          .govWrap{
            display:flex;
            flex-direction: row;
            gap: 16px;
            align-items: flex-start;
            flex-wrap: nowrap;
          }
          .govLeft{
            flex: 0 0 260px;
            min-width: 260px;
          }
          .govMid{
            flex: 1 1 auto;
            min-width: 0; /* critical so middle can shrink and not force wrapping */
          }
          .govRight{
            flex: 0 0 220px;
            min-width: 220px;
          }
          .govList{
            max-height: 560px;
            overflow-y: auto;
            padding-right: 4px;
          }
          /* On small screens, stack (but desktop stays horizontal) */
          @media (max-width: 820px){
            .govWrap{
              flex-direction: column;
            }
            .govLeft, .govRight{
              flex: 0 0 auto;
              min-width: 0;
            }
          }
        `}</style>
      </section>
    </main>
  );
}
