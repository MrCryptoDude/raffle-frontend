"use client";

import * as React from "react";
import Link from "next/link";
import { keccak256, toBytes, encodeFunctionData, isAddress, parseEther } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  governorAbi,
  raffleManagerAbi,
  stakingAbi,
  rpsManagerAbi,
  erc20Abi,
} from "@/lib/abis";
import { addresses } from "@/lib/addresses";

type Mode = "template" | "raw";

type ActionRow = {
  id: string;
  target: string; // address
  valueEth: string; // UI input, converted to wei
  // Raw mode
  calldata: string; // 0x...
  // Template mode
  abiKey: "raffleManagerAbi" | "stakingAbi" | "rpsManagerAbi" | "erc20Abi";
  fnName: string;
  argsJson: string; // JSON array, e.g. [123,"0x..."]
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function safeBytes32HashDescription(desc: string) {
  // OZ uses keccak256(bytes(description))
  return keccak256(toBytes(desc));
}

function parseValueWei(valueEth: string): bigint {
  const v = valueEth.trim();
  if (!v) return 0n;
  // parseEther handles decimals; throws if invalid
  return parseEther(v as `${number}`);
}

function normalizeHexBytes(x: string) {
  const s = x.trim();
  if (s === "") return "0x";
  if (!s.startsWith("0x")) return "0x" + s;
  return s;
}

function getAbiByKey(key: ActionRow["abiKey"]) {
  if (key === "raffleManagerAbi") return raffleManagerAbi;
  if (key === "stakingAbi") return stakingAbi;
  if (key === "rpsManagerAbi") return rpsManagerAbi;
  return erc20Abi;
}

function functionOptionsFromAbi(abi: readonly any[]) {
  return abi
    .filter((x) => x.type === "function")
    .map((x) => x.name as string)
    .filter(Boolean);
}

export default function CreateProposalPage() {
  const governor = addresses.governor;

  const [mode, setMode] = React.useState<Mode>("template");
  const [description, setDescription] = React.useState<string>(
    "TITLE: \n\nDETAILS:\n\n"
  );

  const [rows, setRows] = React.useState<ActionRow[]>(() => [
    {
      id: uid(),
      target: addresses.timelock ?? "",
      valueEth: "0",
      calldata: "0x",
      abiKey: "stakingAbi",
      fnName: "rollEpochIfReady",
      argsJson: "[]",
    },
  ]);

  // Build targets/values/calldatas exactly as will be sent
  const build = React.useMemo(() => {
    const targets: `0x${string}`[] = [];
    const values: bigint[] = [];
    const calldatas: `0x${string}`[] = [];

    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const idx = i + 1;

      if (!isAddress(r.target)) {
        errors.push(`Row ${idx}: invalid target address`);
        continue;
      }

      let valueWei = 0n;
      try {
        valueWei = parseValueWei(r.valueEth);
      } catch {
        errors.push(`Row ${idx}: invalid ETH value`);
        continue;
      }

      let calldata: `0x${string}` = "0x";
      try {
        if (mode === "raw") {
          const raw = normalizeHexBytes(r.calldata);
          // minimal sanity
          if (!raw.startsWith("0x")) throw new Error("bad hex");
          calldata = raw as `0x${string}`;
        } else {
          // template: encodeFunctionData from ABI
          const abi = getAbiByKey(r.abiKey);
          const fn = r.fnName?.trim();
          if (!fn) throw new Error("missing fnName");

          let args: any[] = [];
          try {
            const parsed = JSON.parse(r.argsJson || "[]");
            if (!Array.isArray(parsed)) throw new Error("args must be JSON array");
            args = parsed;
          } catch {
            throw new Error("argsJson must be a JSON array (e.g. [])");
          }

          calldata = encodeFunctionData({
            abi: abi as any,
            functionName: fn as any,
            args,
          }) as `0x${string}`;
        }
      } catch (e: any) {
        errors.push(`Row ${idx}: ${e?.message || "calldata encode error"}`);
        continue;
      }

      targets.push(r.target as `0x${string}`);
      values.push(valueWei);
      calldatas.push(calldata);
    }

    const descriptionHash = safeBytes32HashDescription(description);

    return { targets, values, calldatas, descriptionHash, errors };
  }, [rows, mode, description]);

  // ProposalId preview (on-chain hashProposal)
  const hashProposal = useReadContract({
    address: governor,
    abi: governorAbi,
    functionName: "hashProposal",
    args:
      build.errors.length === 0
        ? [build.targets, build.values, build.calldatas, build.descriptionHash]
        : undefined,
    query: {
      enabled: !!governor && build.errors.length === 0 && build.targets.length > 0,
    },
  });

  const proposalIdPreview = hashProposal.data as unknown as bigint | undefined;

  // Write: propose()
  const { writeContract, data: txHash, isPending } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  function updateRow(id: string, patch: Partial<ActionRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        target: addresses.timelock ?? "",
        valueEth: "0",
        calldata: "0x",
        abiKey: "stakingAbi",
        fnName: "",
        argsJson: "[]",
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function onSubmit() {
    if (!governor) return;
    if (build.errors.length > 0) return;
    if (build.targets.length === 0) return;

    writeContract({
      address: governor,
      abi: governorAbi,
      functionName: "propose",
      args: [build.targets, build.values, build.calldatas, description],
    });
  }

  const primaryDisabled =
    !governor ||
    build.targets.length === 0 ||
    build.errors.length > 0 ||
    isPending;

  // UI: known target shortcuts (optional but helpful)
  const targetPresets: { label: string; value: string }[] = [
    { label: "Governor", value: addresses.governor },
    { label: "Timelock", value: addresses.timelock },
    { label: "Raffle", value: addresses.raffle },
    { label: "Manager", value: addresses.manager },
    { label: "Staking", value: addresses.staking },
    { label: "RPS", value: addresses.rps },
    { label: "VRF Adapter", value: addresses.vrfAdapter },
    { label: "USDC", value: addresses.usdc },
  ].filter((x) => !!x.value);

  return (
    <main className="screen">
      <section className="panel p-5 text-center">
        <div className="h1">CREATE PROPOSAL</div>
        <div className="muted text-[10px] mt-2">
          Byte-exact calldata preview • proposalId consistency • no privileged EOAs
        </div>
        <div className="muted text-[10px] mt-2">
          <Link className="underline" href="/governance">
            ← Back to Governance
          </Link>
        </div>
      </section>

      <section className="mt-5 panel p-5">
        {/* Force 3-column horizontal layout to match your mock */}
        <div className="govWrap">
          {/* LEFT: mode + actions list */}
          <div className="inset p-3 govLeft">
            <div className="h2">ACTIONS</div>
            <div className="muted tiny mt-2">Build targets[] values[] calldatas[]</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`badge ${mode === "template" ? "border-[rgba(180,255,125,0.85)]" : ""}`}
                onClick={() => setMode("template")}
              >
                TEMPLATE MODE
              </button>
              <button
                type="button"
                className={`badge ${mode === "raw" ? "border-[rgba(180,255,125,0.85)]" : ""}`}
                onClick={() => setMode("raw")}
              >
                RAW MODE
              </button>
            </div>

            <div className="mt-3">
              <button className="btn btnBlue w-full" type="button" onClick={addRow}>
                + ADD ACTION
              </button>
            </div>

            <div className="muted tiny mt-3">Scroll • edit a row in the middle</div>

            <div className="mt-3 govList">
              <div className="grid gap-2">
                {rows.map((r, i) => (
                  <div key={r.id} className="inset p-3" style={{ borderWidth: 2 }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="tiny muted">ACTION {i + 1}</div>
                      <button className="tiny underline muted" type="button" onClick={() => removeRow(r.id)}>
                        REMOVE
                      </button>
                    </div>
                    <div className="tiny muted mt-1 truncate">
                      target: {r.target || "—"}
                    </div>
                    <div className="tiny muted truncate">
                      value: {r.valueEth || "0"} ETH
                    </div>
                    <div className="tiny muted truncate">
                      {mode === "template"
                        ? `fn: ${r.fnName || "—"}`
                        : `calldata: ${(r.calldata || "0x").slice(0, 18)}…`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MIDDLE: editor */}
          <div className="inset p-4 govMid">
            <div className="flex items-center justify-between gap-3">
              <div className="h2">CREATE PROPOSAL</div>
              <div className="badge">GOV: {governor}</div>
            </div>

            <div className="mt-4 panel p-3">
              <div className="muted tiny">DESCRIPTION (used for descriptionHash)</div>
              <textarea
                className="input mt-2"
                style={{ width: "100%", minHeight: 140, resize: "vertical" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="muted tiny mt-2">
                descriptionHash = <span className="font-mono">{build.descriptionHash}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {rows.map((r, idx) => {
                const isFirst = idx === 0;
                const abi = getAbiByKey(r.abiKey);
                const fnOptions = functionOptionsFromAbi(abi);

                return (
                  <div key={r.id} className="panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h2">ACTION {idx + 1}</div>
                      <div className="tiny muted">{isFirst ? "Edit rows here" : ""}</div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div>
                        <div className="muted tiny">TARGET</div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <input
                            className="input"
                            style={{ width: "100%" }}
                            value={r.target}
                            onChange={(e) => updateRow(r.id, { target: e.target.value })}
                            placeholder="0x..."
                          />
                          <div className="flex gap-2 flex-wrap">
                            {targetPresets.map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                className="badge"
                                onClick={() => updateRow(r.id, { target: p.value })}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="muted tiny">VALUE (ETH)</div>
                        <input
                          className="input mt-1"
                          style={{ width: "220px" }}
                          value={r.valueEth}
                          onChange={(e) => updateRow(r.id, { valueEth: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      {mode === "raw" ? (
                        <div>
                          <div className="muted tiny">CALLDATA (RAW BYTES)</div>
                          <textarea
                            className="input mt-1"
                            style={{ width: "100%", minHeight: 90, resize: "vertical" }}
                            value={r.calldata}
                            onChange={(e) => updateRow(r.id, { calldata: e.target.value })}
                            placeholder="0x..."
                          />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <div className="grid gap-2" style={{ gridTemplateColumns: "220px 1fr" }}>
                            <div>
                              <div className="muted tiny">ABI</div>
                              <select
                                className="input mt-1"
                                style={{ width: "100%" }}
                                value={r.abiKey}
                                onChange={(e) =>
                                  updateRow(r.id, { abiKey: e.target.value as any, fnName: "", argsJson: "[]" })
                                }
                              >
                                <option value="stakingAbi">stakingAbi</option>
                                <option value="raffleManagerAbi">raffleManagerAbi</option>
                                <option value="rpsManagerAbi">rpsManagerAbi</option>
                                <option value="erc20Abi">erc20Abi</option>
                              </select>
                            </div>

                            <div>
                              <div className="muted tiny">FUNCTION</div>
                              <select
                                className="input mt-1"
                                style={{ width: "100%" }}
                                value={r.fnName}
                                onChange={(e) => updateRow(r.id, { fnName: e.target.value })}
                              >
                                <option value="">Select function…</option>
                                {fnOptions.map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="muted tiny">ARGS (JSON ARRAY)</div>
                            <input
                              className="input mt-1"
                              style={{ width: "100%" }}
                              value={r.argsJson}
                              onChange={(e) => updateRow(r.id, { argsJson: e.target.value })}
                              placeholder='e.g. [] or ["0xabc...", 123]'
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: preview + submit */}
          <div className="inset p-3 govRight">
            <div className="h2">PREVIEW</div>

            <div className="mt-3 panel p-3">
              <div className="muted tiny">PROPOSAL ID (PREVIEW)</div>
              <div className="font-mono text-[10px] mt-2">
                {proposalIdPreview !== undefined ? proposalIdPreview.toString() : "—"}
              </div>
              <div className="muted tiny mt-2">
                Uses Governor.hashProposal(targets, values, calldatas, descriptionHash)
              </div>
            </div>

            <div className="mt-3 panel p-3">
              <div className="muted tiny">TARGETS[]</div>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words">
                {build.targets.length ? JSON.stringify(build.targets, null, 2) : "[]"}
              </pre>

              <div className="muted tiny mt-3">VALUES[] (wei)</div>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words">
                {build.values.length ? JSON.stringify(build.values.map((v) => v.toString()), null, 2) : "[]"}
              </pre>

              <div className="muted tiny mt-3">CALLDATA[] (raw bytes)</div>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words">
                {build.calldatas.length ? JSON.stringify(build.calldatas, null, 2) : "[]"}
              </pre>
            </div>

            {build.errors.length > 0 && (
              <div className="mt-3 panel p-3">
                <div className="muted tiny danger">ERRORS</div>
                <ul className="mt-2 text-[11px]">
                  {build.errors.map((e, i) => (
                    <li key={i} className="danger">
                      - {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3">
              <button className="btn btnBlue w-full" type="button" onClick={onSubmit} disabled={primaryDisabled}>
                {isPending ? "SUBMITTING..." : "SUBMIT PROPOSAL"}
              </button>
              <div className="muted text-[10px] mt-2">
                This will call Governor.propose() with the exact arrays shown above.
              </div>
            </div>

            {txHash && (
              <div className="mt-3 panel p-3">
                <div className="muted tiny">TX</div>
                <div className="font-mono text-[10px] mt-2 break-words">{txHash}</div>
                <div className="muted tiny mt-2">
                  {receipt.isLoading ? "Confirming..." : receipt.isSuccess ? "Confirmed ✓" : ""}
                </div>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .govWrap {
            display: flex;
            flex-direction: row;
            gap: 16px;
            align-items: flex-start;
            flex-wrap: nowrap;
          }
          .govLeft {
            flex: 0 0 260px;
            min-width: 260px;
          }
          .govMid {
            flex: 1 1 auto;
            min-width: 0;
          }
          .govRight {
            flex: 0 0 260px;
            min-width: 260px;
          }
          .govList {
            max-height: 640px;
            overflow-y: auto;
            padding-right: 4px;
          }
          @media (max-width: 820px) {
            .govWrap {
              flex-direction: column;
            }
            .govLeft,
            .govRight {
              flex: 0 0 auto;
              min-width: 0;
            }
          }
        `}</style>
      </section>
    </main>
  );
}
