"use client";

import { useEffect, useState } from "react";

type AgniData = {
  totalTvl: number;
  tokens: {
    USDC: { value: number; percent: number };
    USDY: { value: number; percent: number };
  };
};

export function AgniTokenBreakdown() {
  const [data, setData] = useState<AgniData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/agni");
        if (!res.ok) throw new Error("Failed to fetch Agni data");
        const json = (await res.json()) as AgniData;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown error");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-3 text-xs text-black/40 dark:text-white/40">
        Loading token breakdown…
      </div>
    );
  }

  if (error || !data) {
    return null; // Fail silently
  }

  const { tokens, totalTvl } = data;

  function formatUsd(value: number) {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  }

  function formatPercent(percent: number) {
    return `${percent.toFixed(1)}%`;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
      <div className="text-xs font-medium text-black/60 dark:text-white/60"></div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-black/70 dark:text-white/70">USDC</span>
          <div className="flex items-center gap-2">
            <span className="text-black/50 dark:text-white/50">
              {formatUsd(tokens.USDC.value)}
            </span>
            <span className="font-semibold text-black/80 dark:text-white/80">
              {formatPercent(tokens.USDC.percent)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-black/70 dark:text-white/70">USDY</span>
          <div className="flex items-center gap-2">
            <span className="text-black/50 dark:text-white/50">
              {formatUsd(tokens.USDY.value)}
            </span>
            <span className="font-semibold text-black/80 dark:text-white/80">
              {formatPercent(tokens.USDY.percent)}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-1.5 dark:border-white/5">
          <span className="text-black/50 dark:text-white/50">Total TVL</span>
          <span className="font-semibold text-black/80 dark:text-white/80">
            {formatUsd(totalTvl)}
          </span>
        </div>
      </div>
    </div>
  );
}
