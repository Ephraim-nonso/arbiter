import { NextResponse } from "next/server";

// DefiLlama protocol endpoint for INIT Capital
const INIT_PROTOCOL_URL = "https://api.llama.fi/protocol/init-capital";

type InitProtocolData = {
  id?: string;
  name?: string;
  chainTvls?: {
    Mantle?: Array<{ date: number; totalLiquidityUSD: number }>;
    [key: string]:
      | Array<{ date: number; totalLiquidityUSD: number }>
      | undefined;
  };
  currentChainTvls?: {
    Mantle?: number;
    [key: string]: number | undefined;
  };
  tokensInUsd?: Array<{
    date: number;
    tokens: Record<string, number>;
  }>;
  // Alternative possible field names
  tokens?: Record<string, number>;
  [key: string]: unknown; // Allow any other fields
};

export async function GET() {
  try {
    const res = await fetch(INIT_PROTOCOL_URL, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "init_fetch_failed", status: res.status },
        { status: 502 }
      );
    }

    const data = (await res.json()) as InitProtocolData;

    // Get current TVL on Mantle (prefer currentChainTvls, fallback to latest chainTvls entry)
    let totalTvl = data.currentChainTvls?.Mantle ?? 0;
    if (totalTvl === 0 && data.chainTvls?.Mantle) {
      const mantleTvls = data.chainTvls.Mantle;
      if (mantleTvls.length > 0) {
        totalTvl = mantleTvls[mantleTvls.length - 1]?.totalLiquidityUSD ?? 0;
      }
    }

    // Get the most recent token balances
    // The API response structure: tokensInUsd is an array of { date, tokens: { SYMBOL: value } }
    const tokensData = data.tokensInUsd;
    let usdtValue = 0;
    let mntValue = 0;
    let tokens: Record<string, number> = {};

    if (tokensData && Array.isArray(tokensData) && tokensData.length > 0) {
      // Get the most recent entry (last in array, as it's sorted by date)
      // But also check a few recent entries in case the latest doesn't have all tokens
      const recentEntries = tokensData.slice(-3); // Check last 3 entries

      // Merge tokens from recent entries (later entries override earlier ones)
      for (const entry of recentEntries) {
        if (entry?.tokens && typeof entry.tokens === "object") {
          tokens = { ...tokens, ...entry.tokens };
        }
      }
    } else if (data.tokens && typeof data.tokens === "object") {
      // Fallback: check if tokens are at the root level
      tokens = data.tokens;
    }

    // Debug: log available tokens (in development only)
    if (process.env.NODE_ENV === "development") {
      const tokenKeys = Object.keys(tokens);
      console.log("[init-api] Found tokens:", tokenKeys.length);
      console.log("[init-api] Sample tokens:", tokenKeys.slice(0, 15));
      const usdtKey = tokenKeys.find((k) => k.toUpperCase() === "USDT");
      const mntKey = tokenKeys.find(
        (k) => k.toUpperCase() === "MNT" || k.toUpperCase() === "WMNT"
      );
      console.log(
        "[init-api] USDT key:",
        usdtKey,
        "value:",
        usdtKey ? tokens[usdtKey] : "not found"
      );
      console.log(
        "[init-api] MNT key:",
        mntKey,
        "value:",
        mntKey ? tokens[mntKey] : "not found"
      );
    }

    // Sum up USDT and MNT/WMNT tokens
    for (const [symbol, value] of Object.entries(tokens)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;

      const symbolUpper = symbol.toUpperCase();
      // Match USDT exactly (case-insensitive)
      if (symbolUpper === "USDT") {
        usdtValue += value;
      }
      // Match MNT or WMNT (wrapped Mantle) - case-insensitive
      if (symbolUpper === "MNT" || symbolUpper === "WMNT") {
        mntValue += value;
      }
    }

    // Calculate percentages
    const usdtPercent = totalTvl > 0 ? (usdtValue / totalTvl) * 100 : 0;
    const mntPercent = totalTvl > 0 ? (mntValue / totalTvl) * 100 : 0;

    const response: {
      totalTvl: number;
      tokens: {
        USDT: { value: number; percent: number };
        MNT: { value: number; percent: number };
      };
      debug?: {
        tokensDataLength?: number;
        latestDate?: number;
        availableTokens?: string[];
        usdtMatches?: string[];
        mntMatches?: string[];
      };
    } = {
      totalTvl,
      tokens: {
        USDT: {
          value: usdtValue,
          percent: usdtPercent,
        },
        MNT: {
          value: mntValue,
          percent: mntPercent,
        },
      },
    };

    // Add debug info in development
    if (
      process.env.NODE_ENV === "development" &&
      tokensData &&
      tokensData.length > 0
    ) {
      const latest = tokensData[tokensData.length - 1];
      const tokens = latest?.tokens ?? {};
      const availableTokens = Object.keys(tokens);
      const usdtMatches = availableTokens.filter(
        (s) => s.toUpperCase() === "USDT"
      );
      const mntMatches = availableTokens.filter(
        (s) => s.toUpperCase() === "MNT" || s.toUpperCase() === "WMNT"
      );

      response.debug = {
        tokensDataLength: tokensData.length,
        latestDate: latest?.date,
        availableTokens: availableTokens.slice(0, 20), // First 20 tokens
        usdtMatches,
        mntMatches,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("INIT Capital API error:", error);
    return NextResponse.json({ error: "init_fetch_error" }, { status: 500 });
  }
}

