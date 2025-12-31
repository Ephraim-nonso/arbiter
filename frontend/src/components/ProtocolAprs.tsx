"use client";

import { useEffect, useState } from "react";

type AprResp = {
  chain: string;
  token: string;
  data: Record<string, { apr?: number; project?: string; symbol?: string; tvlUsd?: number }>;
};

function formatApr(apr?: number) {
  if (typeof apr !== "number" || Number.isNaN(apr)) return "—";
  return `${apr.toFixed(2)}%`;
}

export function useProtocolAprs() {
  const [data, setData] = useState<AprResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/apr");
        if (!res.ok) throw new Error("bad response");
        const json = (await res.json()) as AprResp;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    const id = setInterval(run, 5 * 60 * 1000); // refresh every 5 minutes
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, loading };
}

export function ProtocolApr({ protocolKey }: { protocolKey: string }) {
  const { data } = useProtocolAprs();
  const apr = data?.data?.[protocolKey]?.apr;
  return <>{formatApr(apr)}</>;
}



