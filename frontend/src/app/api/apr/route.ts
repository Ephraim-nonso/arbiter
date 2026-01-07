import { NextResponse } from "next/server";

// DefiLlama yields endpoint (public).
// Docs: https://defillama.com/docs/api and https://api-docs.defillama.com/
const YIELDS_POOLS_URL = "https://yields.llama.fi/pools";

type LlamaPool = {
  chain?: string;
  project?: string;
  symbol?: string;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  tvlUsd?: number;
  // pool?: string; // pool id
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

const PROTOCOLS = [
  // NOTE: DefiLlama yields "project" identifiers do NOT always match protocol page slugs.
  // We map to the actual yields dataset identifiers where possible.
  { key: "ondo", name: "Ondo", llamaProjects: ["ondo-finance", "ondo"] },
  { key: "agni", name: "AGNI", llamaProjects: ["agni-finance", "agni"] },
  {
    key: "stargate",
    name: "Stargate",
    llamaProjects: ["stargate-v1", "stargate"],
  },
  {
    key: "pendle",
    name: "Pendle",
    llamaProjects: ["pendle", "pendle-finance"],
  },
  {
    key: "init",
    name: "INIT",
    llamaProjects: ["init-capital", "init capital", "init"],
  },
] as const;

function matchesUsdcSymbol(symbol?: string) {
  if (!symbol) return false;
  // Symbols can look like "USDC", "USDC.e", "USDC / mETH", etc.
  return normalize(symbol).includes("usdc");
}

function matchesMantleChain(chain?: string) {
  if (!chain) return false;
  return normalize(chain) === "mantle";
}

function matchesProtocol(
  project: string | undefined,
  protocolKey: (typeof PROTOCOLS)[number]["key"]
) {
  if (!project) return false;
  const p = normalize(project);
  const proto = PROTOCOLS.find((x) => x.key === protocolKey);
  if (!proto) return false;
  return proto.llamaProjects.some(
    (id) => p === normalize(id) || p.includes(normalize(id))
  );
}

export async function GET() {
  // Cache at the edge/server for 5 minutes.
  const res = await fetch(YIELDS_POOLS_URL, { next: { revalidate: 300 } });
  if (!res.ok) {
    return NextResponse.json(
      { error: "defillama_fetch_failed" },
      { status: 502 }
    );
  }

  const json = (await res.json()) as { data?: LlamaPool[] };
  const pools = Array.isArray(json?.data) ? json.data : [];

  // For each protocol, pick the best candidate USDC pool on Mantle (highest TVL).
  const out: Record<
    string,
    {
      apr?: number;
      project?: string;
      symbol?: string;
      tvlUsd?: number;
      candidates: number;
      note?: string;
    }
  > = {};

  for (const proto of PROTOCOLS) {
    const candidates = pools
      .filter((p) => matchesMantleChain(p.chain))
      .filter((p) => matchesUsdcSymbol(p.symbol))
      .filter((p) => matchesProtocol(p.project, proto.key));

    candidates.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
    const best = candidates[0];

    out[proto.key] = {
      apr: typeof best?.apy === "number" ? best.apy : undefined,
      project: best?.project,
      symbol: best?.symbol,
      tvlUsd: best?.tvlUsd,
      candidates: candidates.length,
      note:
        candidates.length === 0
          ? "No Mantle+USDC pool found in DefiLlama yields dataset for this protocol."
          : undefined,
    };
  }

  return NextResponse.json({ chain: "mantle", token: "USDC", data: out });
}
