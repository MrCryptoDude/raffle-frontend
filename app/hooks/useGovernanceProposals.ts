"use client";

import * as React from "react";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

export type GovernanceProposal = {
  proposalId: bigint;
  proposer: `0x${string}`;
  description: string;
  title: string;
  voteStart: bigint;
  voteEnd: bigint;
};

function titleFromDescription(desc: string) {
  const first = desc.split("\n")[0]?.trim() ?? "";
  return first.length ? first : "(no title)";
}

export function useGovernanceProposals(opts?: { fromBlock?: bigint; limit?: number }) {
  const publicClient = usePublicClient();

  const [data, setData] = React.useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fromBlock = opts?.fromBlock ?? 0n;
  const limit = opts?.limit ?? 50;

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!publicClient) return;

      const governorAddr = addresses.governor;
      if (!governorAddr) {
        setError("Missing NEXT_PUBLIC_GOVERNOR env var.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const proposalCreatedEvent = governorAbi.find(
          (x) => (x as any).type === "event" && (x as any).name === "ProposalCreated"
        ) as any;

        const logs = await publicClient.getLogs({
          address: governorAddr as Address,
          event: proposalCreatedEvent,
          fromBlock,
          toBlock: "latest",
        });

        // newest first
        logs.sort((a: any, b: any) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)));

        const proposals: GovernanceProposal[] = logs.slice(0, limit).map((log: any) => {
          const a = log.args;
          const description: string = a.description;

          return {
            proposalId: a.proposalId as bigint,
            proposer: a.proposer as `0x${string}`,
            description,
            title: titleFromDescription(description),
            voteStart: a.voteStart as bigint,
            voteEnd: a.voteEnd as bigint,
          };
        });

        if (!cancelled) setData(proposals);
      } catch (e: any) {
        if (!cancelled) setError(e?.shortMessage || e?.message || "Failed to read proposals.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [publicClient, fromBlock, limit]);

  return { data, loading, error };
}
