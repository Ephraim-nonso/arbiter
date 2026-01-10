"use client";

import { useEffect, useState } from "react";

type InitData = {
  totalTvl: number;
  tokens: {
    USDT: { value: number; percent: number };
    MNT: { value: number; percent: number };
  };
};

export function InitTokenBreakdown() {
  const [data, setData] = useState<InitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/init");
        if (!res.ok) throw new Error("Failed to fetch INIT data");
        const json = (await res.json()) as InitData;
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
          <span className="text-black/70 dark:text-white/70">USDT</span>
          <div className="flex items-center gap-2">
            <span className="text-black/50 dark:text-white/50">
              {formatUsd(tokens.USDT.value)}
            </span>
            <span className="font-semibold text-black/80 dark:text-white/80">
              {formatPercent(tokens.USDT.percent)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-black/70 dark:text-white/70">MNT</span>
          <div className="flex items-center gap-2">
            <span className="text-black/50 dark:text-white/50">
              {formatUsd(tokens.MNT.value)}
            </span>
            <span className="font-semibold text-black/80 dark:text-white/80">
              {formatPercent(tokens.MNT.percent)}
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
