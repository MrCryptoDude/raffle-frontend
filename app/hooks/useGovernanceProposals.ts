"use client";

import * as React from "react";
import { usePublicClient, useChainId } from "wagmi";
import type { Address } from "viem";
import { governorAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";

export type GovernanceProposal = {
  proposalId: bigint;
  proposer: `0x${string}`;
  targets?: string[];
  description: string;
  title: string;
  voteStart: bigint;
  voteEnd: bigint;
};

function titleFromDescription(desc: string) {
  // Remove [SIGNAL] prefix if present
  let cleaned = desc.replace(/^\[SIGNAL\]\s*/i, "");
  // Remove emoji at start if present
  cleaned = cleaned.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, "");
  const first = cleaned.split("\n")[0]?.trim() ?? "";
  return first.length ? first : "(no title)";
}

export function useGovernanceProposals(opts?: { fromBlock?: bigint; limit?: number }) {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [data, setData] = React.useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const limit = opts?.limit ?? 50;

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!publicClient) {
        setError("No wallet connected");
        return;
      }

      const governorAddr = addresses.governor;
      if (!governorAddr) {
        setError("Governor contract not configured");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get current block
        let currentBlock: bigint;
        try {
          currentBlock = await publicClient.getBlockNumber();
        } catch (e) {
          console.error("Failed to get block number:", e);
          setError("Failed to connect to network");
          setLoading(false);
          return;
        }

        // Start from a reasonable block - try progressively smaller ranges
        // Base Sepolia started around block 15M, so go back further
        const ranges = [500000n, 200000n, 100000n, 50000n, 10000n];
        let logs: any[] = [];
        let success = false;

        for (const range of ranges) {
          const fromBlock = currentBlock > range ? currentBlock - range : 0n;
          
          try {
            const proposalCreatedEvent = governorAbi.find(
              (x) => (x as any).type === "event" && (x as any).name === "ProposalCreated"
            ) as any;

            if (!proposalCreatedEvent) {
              setError("ProposalCreated event not found in ABI");
              setLoading(false);
              return;
            }

            logs = await publicClient.getLogs({
              address: governorAddr as Address,
              event: proposalCreatedEvent,
              fromBlock,
              toBlock: "latest",
            });

            success = true;
            break; // Success! Exit the loop
          } catch (e: any) {
            console.warn(`Failed with range ${range}, trying smaller...`, e.message);
            // Continue to next smaller range
          }
        }

        if (!success) {
          // Last resort: try just the last 1000 blocks
          try {
            const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
            const proposalCreatedEvent = governorAbi.find(
              (x) => (x as any).type === "event" && (x as any).name === "ProposalCreated"
            ) as any;

            logs = await publicClient.getLogs({
              address: governorAddr as Address,
              event: proposalCreatedEvent,
              fromBlock,
              toBlock: "latest",
            });
          } catch (e: any) {
            console.error("All block ranges failed:", e);
            if (!cancelled) {
              setError("Unable to fetch proposals. RPC may be rate limited.");
            }
            setLoading(false);
            return;
          }
        }

        console.log(`[Governance] Found ${logs.length} proposal logs`);
        if (logs.length > 0) {
          console.log('[Governance] First log:', logs[0]);
        }

        // newest first
        logs.sort((a: any, b: any) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)));

        const proposals: GovernanceProposal[] = logs
          .map((log: any) => {
            const a = log.args;
            if (!a || !a.proposalId) return null; // Skip invalid logs
            
            const description: string = a.description ?? "";

            return {
              proposalId: a.proposalId as bigint,
              proposer: a.proposer as `0x${string}`,
              targets: a.targets as string[] | undefined,
              description,
              title: titleFromDescription(description),
              voteStart: a.voteStart as bigint,
              voteEnd: a.voteEnd as bigint,
            };
          })
          .filter((p): p is GovernanceProposal => p !== null)
          .slice(0, limit);

        if (!cancelled) {
          setData(proposals);
          if (proposals.length === 0) {
            // Not an error, just no proposals yet
            setError(null);
          }
        }
      } catch (e: any) {
        console.error("Failed to load proposals:", e);
        if (!cancelled) {
          setError(e?.shortMessage || e?.message || "Failed to read proposals");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [publicClient, chainId, limit]);

  return { data, loading, error };
}
