import { z } from "zod";

type LlamaPool = {
  pool?: string;
  chain?: string;
  project?: string;
  symbol?: string;
  apy?: number;
  tvlUsd?: number;
};

const PoolsResponseSchema = z.object({
  data: z.array(z.any()),
});

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export async function fetchDefiLlamaPools({
  chain = "Mantle",
  stableHint = "USDC",
  minTvlUsd = 50_000,
  topK = 7,
}: {
  chain?: string;
  stableHint?: string;
  minTvlUsd?: number;
  topK?: number;
}) {
  const url = process.env.LLAMA_POOLS_URL || "https://yields.llama.fi/pools";
  const timeoutMs = Number(process.env.LLAMA_FETCH_TIMEOUT_MS ?? "30000");
  const signal =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`DefiLlama fetch failed (${res.status})`);
  const json = PoolsResponseSchema.parse(await res.json());
  const pools: LlamaPool[] = (json.data ?? []) as LlamaPool[];

  const chainLc = normalize(chain);
  const hintLc = normalize(stableHint);

  const filtered = pools
    .filter((p) => normalize(p.chain ?? "") === chainLc)
    .filter((p) => normalize(p.symbol ?? "").includes(hintLc))
    .filter((p) => (p.tvlUsd ?? 0) >= minTvlUsd)
    .filter(
      (p) =>
        Number.isFinite(p.apy ?? NaN) &&
        (p.apy ?? 0) > 0 &&
        (p.apy ?? 0) < 1_000_000
    )
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
    .slice(0, topK);

  return filtered.map((p) => ({
    pool: p.pool ?? "",
    chain: p.chain ?? "",
    project: p.project ?? "",
    symbol: p.symbol ?? "",
    apy: p.apy ?? 0,
    tvlUsd: p.tvlUsd ?? 0,
  }));
}

export const fetchDefiLlamaPoolsMetadata = {
  name: "fetchDefiLlamaPools",
  description:
    "Fetch top-yield pools from DefiLlama yields dataset (filtered by chain + stable symbol hint).",
  schema: z.object({
    chain: z.string().default("Mantle"),
    stableHint: z.string().default("USDC"),
    minTvlUsd: z.number().default(50_000),
    topK: z.number().int().min(1).max(50).default(7),
  }),
};
