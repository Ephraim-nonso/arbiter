import { NextResponse } from "next/server";

// DefiLlama protocol endpoint for Pendle
const PENDLE_PROTOCOL_URL = "https://api.llama.fi/protocol/pendle";

type PendleProtocolData = {
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
    const res = await fetch(PENDLE_PROTOCOL_URL, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "pendle_fetch_failed", status: res.status },
        { status: 502 }
      );
    }

    const data = (await res.json()) as PendleProtocolData;

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
    let usdcValue = 0;
    let usdyValue = 0;
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
      console.log("[pendle-api] Found tokens:", tokenKeys.length);
      console.log("[pendle-api] Sample tokens:", tokenKeys.slice(0, 15));
      const usdcKey = tokenKeys.find(
        (k) => k.toUpperCase() === "USDC" || k.toUpperCase().includes("USDC")
      );
      const usdyKey = tokenKeys.find((k) => k.toUpperCase() === "USDY");
      console.log(
        "[pendle-api] USDC key:",
        usdcKey,
        "value:",
        usdcKey ? tokens[usdcKey] : "not found"
      );
      console.log(
        "[pendle-api] USDY key:",
        usdyKey,
        "value:",
        usdyKey ? tokens[usdyKey] : "not found"
      );
    }

    // Sum up all USDC variants (USDC, AXLUSDC, etc.) and USDY
    for (const [symbol, value] of Object.entries(tokens)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;

      const symbolUpper = symbol.toUpperCase();
      // Match USDC and variants (case-insensitive)
      if (symbolUpper === "USDC" || symbolUpper.includes("USDC")) {
        usdcValue += value;
      }
      // Match USDY exactly (case-insensitive)
      if (symbolUpper === "USDY") {
        usdyValue += value;
      }
    }

    // Calculate percentages
    const usdcPercent = totalTvl > 0 ? (usdcValue / totalTvl) * 100 : 0;
    const usdyPercent = totalTvl > 0 ? (usdyValue / totalTvl) * 100 : 0;

    const response: {
      totalTvl: number;
      tokens: {
        USDC: { value: number; percent: number };
        USDY: { value: number; percent: number };
      };
      debug?: {
        tokensDataLength?: number;
        latestDate?: number;
        availableTokens?: string[];
        usdcMatches?: string[];
        usdyMatches?: string[];
      };
    } = {
      totalTvl,
      tokens: {
        USDC: {
          value: usdcValue,
          percent: usdcPercent,
        },
        USDY: {
          value: usdyValue,
          percent: usdyPercent,
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
      const usdcMatches = availableTokens.filter((s) =>
        s.toUpperCase().includes("USDC")
      );
      const usdyMatches = availableTokens.filter(
        (s) => s.toUpperCase() === "USDY"
      );

      response.debug = {
        tokensDataLength: tokensData.length,
        latestDate: latest?.date,
        availableTokens: availableTokens.slice(0, 20), // First 20 tokens
        usdcMatches,
        usdyMatches,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Pendle API error:", error);
    return NextResponse.json({ error: "pendle_fetch_error" }, { status: 500 });
  }
}

