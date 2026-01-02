"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { targetChain } from "@/lib/wagmi";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { YieldProjectionChart } from "@/components/YieldProjectionChart";
import { Modal } from "@/components/Modal";
import { FundAgentForm } from "@/components/FundAgentForm";

type ViewTab = "position" | "projection";

function shortAddr(a?: string | null) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}

export default function VaultPage() {
  const { status, address } = useConnection();
  const isConnected = status === "connected";
  const owner = useMemo(() => (address ? address.toLowerCase() : null), [address]);

  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<ViewTab>("position");
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  // MVP values (replace with on-chain reads once protocol adapters land).
  const totalBalance = 10.07;
  const totalDeposited = 10.07;
  const lifetimeEarnings = 0.0;
  const agentApr = 5.62;
  const arbiterRewardsApr = 9.38;
  const netApr = 15.0;

  useEffect(() => {
    if (!isConnected || !owner) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/safe?chainId=${encodeURIComponent(String(targetChain.id))}&owner=${encodeURIComponent(owner)}`
        );
        const json = (await res.json()) as { safeAddress?: string | null };
        if (cancelled) return;
        setSafeAddress(json.safeAddress ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, owner]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <SiteHeader />
        <main className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-40">
          <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/70 shadow-sm dark:border-white/15 dark:bg-black dark:text-white/70">
            Connect your wallet to view your vault dashboard.
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <SiteHeader />
        <main className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-40">
          <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/70 shadow-sm dark:border-white/15 dark:bg-black dark:text-white/70">
            Loading vault…
          </div>
        </main>
      </div>
    );
  }

  if (!safeAddress) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <SiteHeader />
        <main className="mx-auto w-full px-6 py-10 sm:px-10 lg:px-40">
          <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/70 shadow-sm dark:border-white/15 dark:bg-black dark:text-white/70">
            <div className="font-semibold text-black/90 dark:text-white/90">
              No vault found
            </div>
            <div className="mt-1 text-sm text-black/60 dark:text-white/60">
              Deploy a vault first, then come back here to manage it.
            </div>
            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-full bg-lime-400 px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
              >
                Go to home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
      <SiteHeader />
      <main className="mx-auto w-full px-6 pb-12 pt-4 sm:px-10 lg:px-40">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">
              Arbiter Vault Dashboard
            </div>
            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
              Safe:{" "}
              <span className="font-mono text-black/70 dark:text-white/70">
                {shortAddr(safeAddress)}{" "}
              </span>
              <span className="text-black/35 dark:text-white/35">
                ({targetChain.name})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
              onClick={() => alert("Deactivate agent (TODO)")}
            >
              Deactivate
            </button>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
              onClick={() => setAddFundsOpen(true)}
            >
              Add funds
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: Main panel */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-black">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-black/10 bg-black/5 p-1 dark:border-white/15 dark:bg-white/10">
              <button
                type="button"
                className={[
                  "h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition",
                  tab === "position"
                    ? "bg-lime-400 text-black"
                    : "text-black/60 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10",
                ].join(" ")}
                onClick={() => setTab("position")}
              >
                Position Value
              </button>
              <button
                type="button"
                className={[
                  "h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition",
                  tab === "projection"
                    ? "bg-lime-400 text-black"
                    : "text-black/60 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10",
                ].join(" ")}
                onClick={() => setTab("projection")}
              >
                Yield Projection
              </button>
            </div>
          </div>

          {tab === "position" ? (
            <>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Total balance
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-white">
                    {totalBalance.toFixed(2)}{" "}
                    <span className="text-black/70 dark:text-white/70">USDC</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/15 dark:bg-white/10">
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Total deposited
                  </div>
                  <div className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {totalDeposited.toFixed(2)} USDC
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/15 dark:bg-white/10">
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Lifetime earnings
                  </div>
                  <div className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {lifetimeEarnings.toFixed(2)} USDC{" "}
                    <span className="text-black/50 dark:text-white/50">
                      (0.00%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-black">
                <div className="text-xs text-black/50 dark:text-white/50">
                  Position chart (placeholder)
                </div>
                <div className="mt-3 h-40 rounded-xl border border-dashed border-black/15 bg-black/5 dark:border-white/15 dark:bg-white/5" />
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Agent APR
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-white">
                    {formatPct(agentApr)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Mantle Rewards APR
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-white">
                    {formatPct(arbiterRewardsApr)}
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/15 dark:bg-white/10">
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Annual projection
                  </div>
                  <div className="mt-1 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    +{(totalBalance * (netApr / 100)).toFixed(2)} USDC per year
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-black">
                <div className="text-xs text-black/50 dark:text-white/50">
                  Projection chart
                </div>
                <div className="mt-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-black">
                  <YieldProjectionChart
                    initialUsdc={totalBalance}
                    agentAprPct={agentApr}
                    rewardsAprPct={arbiterRewardsApr}
                  />
                </div>
                <div className="mt-3 text-[11px] leading-4 text-black/45 dark:text-white/45">
                  Disclosure: projection is indicative and may change with market conditions, pool
                  yields, and reward emissions.
                </div>
              </div>
            </>
          )}

          <div className="mt-8">
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">
              Agent Execution History
            </div>
            <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-black">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-black/90 dark:text-white/90">
                    Position allocated to the best available lending market
                  </div>
                  <div className="mt-1 text-xs text-black/50 dark:text-white/50">
                    {totalBalance.toFixed(2)} USDC allocated • {formatPct(agentApr)} yield
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-black/50 dark:text-white/50">
                  <div className="font-semibold text-black/70 dark:text-white/70">
                    Dec 28, 2025
                  </div>
                  <div className="mt-1">Executed at 00:26</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-black">
            <div className="inline-flex items-center rounded-full bg-lime-400/15 px-3 py-1 text-xs font-semibold text-black/80 dark:text-white/80">
              NEW {formatPct(netApr)} APR
            </div>
            <div className="mt-4 text-xl font-semibold text-black dark:text-white">
              Earn smarter with Mantle rewards
            </div>
            <div className="mt-4 text-xs text-black/50 dark:text-white/50">
              Total Mantle Rewards
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-black dark:text-white">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 dark:border-white/15">
                ✦
              </span>
              0 MNT
            </div>
            <button
              type="button"
              className="mt-5 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-lime-400 px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
              onClick={() => alert("Stake MNT (TODO)")}
            >
              Stake MNT
            </button>
            <div className="mt-3 text-[11px] leading-4 text-black/45 dark:text-white/45">
              MVP: staking UX is a placeholder. We’ll wire to a Mantle staking/rewards contract.
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-black">
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">
              Mantle Net APR
            </div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-black dark:text-white">
              {formatPct(netApr)}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-black/60 dark:text-white/60">
                  Current Position APR
                </div>
                <div className="font-semibold text-black dark:text-white">
                  {formatPct(agentApr)}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-black/60 dark:text-white/60">
                  Mantle Rewards APR
                </div>
                <div className="font-semibold text-black dark:text-white">
                  {formatPct(arbiterRewardsApr)}
                </div>
              </div>
              <div className="h-px bg-black/10 dark:bg-white/10" />
              <div className="flex items-center justify-between text-sm">
                <div className="text-black/60 dark:text-white/60">
                  Activation Date
                </div>
                <div className="font-semibold text-black dark:text-white">
                  Dec 28, 2025 • 00:26
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-black/60 dark:text-white/60">
                  Total Deposits
                </div>
                <div className="font-semibold text-black dark:text-white">
                  {totalDeposited.toFixed(2)} USDC
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
                onClick={() => alert("Show details (TODO)")}
              >
                Show details
              </button>
            </div>
          </div>
        </div>
      </div>

        <Modal
          open={addFundsOpen}
          title="Fund your Agent"
          onClose={() => setAddFundsOpen(false)}
        >
          <FundAgentForm
            depositAmount={depositAmount}
            onChangeDepositAmount={setDepositAmount}
            primaryLabel="Deposit USDC"
            primaryVariant="primary"
            onPrimary={() => {
              // TODO(arbiter): wire to USDC transfer/approval into the user's Safe.
              setAddFundsOpen(false);
            }}
          />
        </Modal>
      </main>
    </div>
  );
}


