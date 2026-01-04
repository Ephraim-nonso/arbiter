import { z } from "zod";

/**
 * Protocol IDs must match:
 * - contracts/src/libraries/ProtocolIds.sol
 * - zk/circuits/policy.circom
 */
const N = 5;

function protocolIdFromPoolProject(project: string): number | null {
  const p = project.trim().toLowerCase();
  if (p.includes("ondo")) return 0;
  if (p.includes("agni")) return 1;
  if (p.includes("stargate")) return 2;
  if (p.includes("mantle")) return 3;
  if (p.includes("init")) return 4;
  return null;
}

function parseCapsCsv(capsBpsCsv: string): number[] {
  const parts = capsBpsCsv.split(",").map((s) => s.trim());
  if (parts.length !== N) throw new Error(`capsBpsCsv must have ${N} entries`);
  const caps = parts.map((x) => Number(x));
  if (caps.some((x) => !Number.isFinite(x) || x < 0 || x > 10000)) {
    throw new Error("capsBpsCsv must be numbers in [0, 10000]");
  }
  return caps;
}

/**
 * Simple optimizer:
 * - For each protocol (0..4), look at best pool APY
 * - Allocate proportionally to APY weights, then clamp by caps and allowBitmap, and renormalize to 10000.
 * This is intentionally simple; the LLM can reason about the choice of weights, but we keep output valid.
 */
export async function optimizeAllocations({
  pools,
  allowBitmap,
  capsBpsCsv,
}: {
  pools: Array<{ project: string; apy: number }>;
  allowBitmap: number;
  capsBpsCsv: string;
}) {
  const caps = parseCapsCsv(capsBpsCsv);

  const bestApyByProtocol = new Array<number>(N).fill(0);
  for (const p of pools) {
    const pid = protocolIdFromPoolProject(p.project || "");
    if (pid == null) continue;
    if (!Number.isFinite(p.apy) || p.apy <= 0) continue;
    bestApyByProtocol[pid] = Math.max(bestApyByProtocol[pid], p.apy);
  }

  const allowed = new Array<boolean>(N).fill(false).map((_, i) => (((allowBitmap >> i) & 1) === 1));
  const weights = bestApyByProtocol.map((apy, i) => (allowed[i] ? apy : 0));
  const sumW = weights.reduce((a, b) => a + b, 0);

  // If no weights, allocate everything to the first allowed protocol (if any).
  let raw = new Array<number>(N).fill(0);
  if (sumW <= 0) {
    const first = allowed.findIndex(Boolean);
    if (first === -1) throw new Error("allowBitmap has no allowed protocols.");
    raw[first] = 10000;
  } else {
    raw = weights.map((w) => (w / sumW) * 10000);
  }

  // Clamp to caps + disallow
  let alloc = raw.map((v, i) => {
    if (!allowed[i]) return 0;
    return Math.min(Math.floor(v), caps[i]);
  });

  // Renormalize to sum=10000 by distributing remainder to allowed protocols with slack.
  let sum = alloc.reduce((a, b) => a + b, 0);
  let remainder = 10000 - sum;
  if (remainder < 0) {
    // If we over-allocated due to caps rounding (shouldn't happen), trim from largest allocations.
    const order = [...alloc.keys()].sort((a, b) => alloc[b] - alloc[a]);
    for (const i of order) {
      const take = Math.min(alloc[i], -remainder);
      alloc[i] -= take;
      remainder += take;
      if (remainder === 0) break;
    }
  } else if (remainder > 0) {
    const order = [...alloc.keys()].sort((a, b) => weights[b] - weights[a]);
    // distribute 1bp at a time (N is tiny)
    while (remainder > 0) {
      let progressed = false;
      for (const i of order) {
        if (!allowed[i]) continue;
        if (alloc[i] >= caps[i]) continue;
        alloc[i] += 1;
        remainder -= 1;
        progressed = true;
        if (remainder === 0) break;
      }
      if (!progressed) break; // no slack left
    }
  }

  sum = alloc.reduce((a, b) => a + b, 0);
  if (sum !== 10000) {
    throw new Error(`optimizer could not satisfy sum=10000 under caps (sum=${sum}). Increase caps.`);
  }

  return {
    allowBitmap,
    capsBpsCsv,
    allocationsCsv: alloc.join(","),
    allocationsBps: alloc,
    bestApyByProtocol,
  };
}

export const optimizeAllocationsMetadata = {
  name: "optimizeAllocations",
  description:
    "Compute a valid allocation vector (bps, sum=10000) across 5 protocols, obeying allowBitmap and capsBps.",
  schema: z.object({
    pools: z.array(
      z.object({
        project: z.string(),
        apy: z.number(),
      })
    ),
    allowBitmap: z.number().int().min(0),
    capsBpsCsv: z.string(),
  }),
};


