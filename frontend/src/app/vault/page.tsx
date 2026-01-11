"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWalletClient } from "wagmi";
import { targetChain } from "@/lib/wagmi";
import { SiteHeader } from "@/components/SiteHeader";
import { YieldProjectionChart } from "@/components/YieldProjectionChart";
import { Modal } from "@/components/Modal";
import { FundAgentForm } from "@/components/FundAgentForm";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DeployVaultModal } from "@/components/DeployVaultModal";
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  type Address,
} from "viem";
import { deploySafe4337 } from "@/lib/safeDeploy";
import {
  formatUsdcFromMicros,
  getUsdcAddressForChain,
  parseUsdcToMicros,
} from "@/lib/usdc";
import { fetchUsdcDepositStats } from "@/lib/deposits";
import { getSafeAccount, getSafeSmartAccountClient } from "@/lib/safeDeploy";
import { toast } from "react-toastify";

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
  const owner = useMemo(
    () => (address ? address.toLowerCase() : null),
    [address]
  );
  const { data: walletClient } = useWalletClient();

  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [safeDeployed, setSafeDeployed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<ViewTab>("position");
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [totalDeposited, setTotalDeposited] = useState<number | null>(null);
  const [lastDepositTs, setLastDepositTs] = useState<number | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);
  const [editPolicyOpen, setEditPolicyOpen] = useState(false);

  // MVP values (replace with on-chain reads once protocol adapters land).
  const lifetimeEarnings = 0.0;
  const agentApr = 5.62;
  const arbiterRewardsApr = 9.38;
  const netApr = 15.0;

  async function refreshBalances(safe: string) {
    const publicClient = createPublicClient({
      chain: targetChain,
      transport: http(targetChain.rpcUrls.default.http[0]),
    });
    const usdc = getUsdcAddressForChain(targetChain.id);
    const bal = await publicClient.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [safe as Address],
    });
    setUsdcBalance(formatUsdcFromMicros(bal));
  }

  async function refreshDeposits(safe: string) {
    const publicClient = createPublicClient({
      chain: targetChain,
      transport: http(targetChain.rpcUrls.default.http[0]),
    });

    const stats = await fetchUsdcDepositStats({
      publicClient,
      chainId: targetChain.id,
      safeAddress: safe as Address,
    });

    // We display "Total deposited" as net deposits (deposits - withdrawals) for user intuition.
    setTotalDeposited(formatUsdcFromMicros(stats.net));
    setLastDepositTs(stats.lastInTsMs);
  }

  // Reset all state when wallet address changes
  useEffect(() => {
    if (!isConnected || !owner) {
      // Clear state when disconnected
      setSafeAddress(null);
      setSafeDeployed(false);
      setUsdcBalance(null);
      setTotalDeposited(null);
      setLastDepositTs(null);
      return;
    }
  }, [isConnected, owner]);

  useEffect(() => {
    if (!isConnected || !owner) return;
    if (!walletClient) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Safe address is deterministic for (owner, saltNonce) and doesn't require backend storage.
        const { publicClient, safeAddress: addr } = await getSafeAccount({
          walletClient,
        });
        if (cancelled) return;
        setSafeAddress(addr);

        // Check if Safe is actually deployed on-chain
        const bytecode = await publicClient.getBytecode({ address: addr });
        const deployed = !!bytecode && bytecode !== "0x";
        if (cancelled) return;
        setSafeDeployed(deployed);

        // If not deployed, clear balance/deposit data
        if (!deployed) {
          setUsdcBalance(null);
          setTotalDeposited(null);
          setLastDepositTs(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, owner, walletClient]);

  useEffect(() => {
    // Only refresh balances if Safe is deployed
    if (!safeAddress || !safeDeployed) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          refreshBalances(safeAddress),
          refreshDeposits(safeAddress),
        ]);
      } catch {
        if (!cancelled) {
          setUsdcBalance(null);
          setTotalDeposited(null);
          setLastDepositTs(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [safeAddress, safeDeployed]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <SiteHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10 sm:px-10 lg:px-40">
          <div className="w-full max-w-lg">
            <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white to-black/5 p-8 text-center shadow-lg dark:border-white/15 dark:from-black dark:to-white/5">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-black/60 dark:text-white/60"
                >
                  <path
                    d="M19 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-black/90 dark:text-white/90">
                Connect Your Wallet
              </h2>
              <p className="mt-2 text-sm leading-6 text-black/60 dark:text-white/60">
                Connect your wallet to view and manage your Arbiter vault
                dashboard.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <SiteHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10 sm:px-10 lg:px-40">
          <LoadingSpinner />
        </main>
      </div>
    );
  }

  if (!safeAddress || !safeDeployed) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
        <SiteHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10 sm:px-10 lg:px-40">
          <div className="w-full max-w-lg">
            <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white to-lime-50/50 p-8 text-center shadow-lg dark:border-white/15 dark:from-black dark:to-lime-950/20">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10 dark:border-lime-400/30 dark:bg-lime-400/5">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-lime-600 dark:text-lime-400"
                >
                  <path
                    d="M20 7h-3V4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 4v3h6V4M9 4v3h6V4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.5"
                  />
                  <path
                    d="M12 12v4M10 14h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-black/90 dark:text-white/90">
                No Vault Found
              </h2>
              <p className="mt-2 text-sm leading-6 text-black/60 dark:text-white/60">
                You don&apos;t have a vault deployed yet. Deploy one to start
                earning yield with Arbiter&apos;s automated yield optimization.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setDeployOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime-400 px-6 text-sm font-semibold text-black shadow-md transition-all hover:bg-lime-300 hover:shadow-lg active:scale-[0.98]"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-black"
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Deploy Vault
                </button>
              </div>
            </div>
          </div>
        </main>
        <DeployVaultModal
          open={deployOpen}
          onClose={() => setDeployOpen(false)}
          onDeployVault={async () => {
            if (!walletClient) {
              throw new Error("Wallet not connected");
            }
            const { safeAddress: deployedAddr } = await deploySafe4337({
              walletClient,
            });
            // Refresh the page state after deployment
            const { publicClient, safeAddress: addr } = await getSafeAccount({
              walletClient,
            });
            const bytecode = await publicClient.getBytecode({ address: addr });
            setSafeAddress(addr);
            setSafeDeployed(!!bytecode && bytecode !== "0x");
            return deployedAddr;
          }}
        />
      </div>
    );
  }

  const totalBalance = usdcBalance ?? 0;
  const totalDepositedDisplay = totalDeposited ?? 0;
  const depositDateText =
    lastDepositTs == null
      ? "--"
      : new Date(lastDepositTs).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

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
              <a
                href={`${
                  targetChain.blockExplorers?.default.url ??
                  "https://explorer.testnet.mantle.xyz"
                }/address/${safeAddress}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-black/70 underline decoration-black/20 underline-offset-2 hover:text-black dark:text-white/70 dark:decoration-white/20 dark:hover:text-white"
                title="View on explorer"
              >
                {shortAddr(safeAddress)}{" "}
              </a>
              <span className="text-black/35 dark:text-white/35">
                ({targetChain.name})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
              onClick={() => {
                setEditPolicyOpen(true);
              }}
            >
              Edit Policy
            </button>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
              onClick={() => {
                setDeactivateError(null);
                setDeactivateOpen(true);
              }}
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
                      <span className="text-black/70 dark:text-white/70">
                        USDC
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/15 dark:bg-white/10">
                    <div className="text-xs text-black/50 dark:text-white/50">
                      Total deposited
                    </div>
                    <div className="mt-1 text-sm font-semibold text-black dark:text-white">
                      {totalDepositedDisplay.toFixed(2)} USDC
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
                      +{(totalBalance * (netApr / 100)).toFixed(2)} USDC per
                      year
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
                    Disclosure: projection is indicative and may change with
                    market conditions, pool yields, and reward emissions.
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
                      {totalBalance.toFixed(2)} USDC allocated •{" "}
                      {formatPct(agentApr)} yield
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-black/50 dark:text-white/50">
                    <div className="font-semibold text-black/70 dark:text-white/70">
                      {lastDepositTs == null
                        ? "--"
                        : new Date(lastDepositTs).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            }
                          )}
                    </div>
                    <div className="mt-1">
                      {lastDepositTs == null
                        ? "No deposits yet"
                        : `Deposited at ${new Date(
                            lastDepositTs
                          ).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`}
                    </div>
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
                Earn smarter with Mantle Rewards Station
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
                MVP: staking UX is a placeholder. We’ll wire to a Mantle
                staking/rewards contract.
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
                    {depositDateText}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-black/60 dark:text-white/60">
                    Total Deposits
                  </div>
                  <div className="font-semibold text-black dark:text-white">
                    {totalDepositedDisplay.toFixed(2)} MNT
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
            primaryLabel={depositBusy ? "Depositing…" : "Deposit USDC"}
            primaryVariant="primary"
            balanceText={usdcBalance == null ? "--" : usdcBalance.toFixed(2)}
            disabledPrimary={depositBusy}
            errorText={depositError}
            onPrimary={async () => {
              if (!walletClient) {
                setDepositError("Wallet not ready. Reconnect and try again.");
                return;
              }
              try {
                setDepositError(null);
                setDepositBusy(true);
                const amountMicros = parseUsdcToMicros(depositAmount);
                const usdc = getUsdcAddressForChain(targetChain.id);
                const hash = await walletClient.writeContract({
                  address: usdc,
                  abi: erc20Abi,
                  functionName: "transfer",
                  args: [safeAddress as Address, amountMicros],
                });
                const publicClient = createPublicClient({
                  chain: targetChain,
                  transport: http(targetChain.rpcUrls.default.http[0]),
                });

                // Wait for transaction receipt with extended timeout and polling
                await publicClient.waitForTransactionReceipt({
                  hash,
                  timeout: 120_000, // 120 seconds timeout
                  pollingInterval: 2_000, // Poll every 2 seconds
                });

                // Show success toast
                toast.success(
                  `Successfully deposited ${depositAmount} USDC to vault!`,
                  {
                    position: "top-right",
                    autoClose: 5000,
                  }
                );

                setAddFundsOpen(false);
                setDepositAmount("");
                await Promise.all([
                  refreshBalances(safeAddress),
                  refreshDeposits(safeAddress),
                ]);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Deposit failed.";
                setDepositError(msg);

                // Show error toast
                toast.error(`Deposit failed: ${msg}`, {
                  position: "top-right",
                  autoClose: 7000,
                });
              } finally {
                setDepositBusy(false);
              }
            }}
          />
        </Modal>

        <Modal
          open={deactivateOpen}
          title="Agent deactivation"
          onClose={() => {
            if (deactivateBusy) return;
            setDeactivateOpen(false);
          }}
        >
          <div className="space-y-4">
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">
              Anon, you sure you want to stop optimizing yield?
            </div>
            <div className="text-sm leading-6 text-black/60 dark:text-white/60">
              Deactivating pauses Arbiter’s automation and returns your USDC
              from the vault to your wallet. You can re-activate anytime.
            </div>

            <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/15 dark:bg-white/10">
              <div className="text-xs text-black/50 dark:text-white/50">
                Assets returned on deactivation
              </div>
              <div className="mt-2 text-sm font-semibold text-black dark:text-white">
                {totalBalance.toFixed(6)} USDC
              </div>
              <div className="mt-1 text-xs text-black/50 dark:text-white/50">
                Sent to:{" "}
                <span className="font-mono">
                  {address ? shortAddr(address) : "--"}
                </span>
              </div>
            </div>

            {deactivateError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-black/80 dark:text-white/80">
                <div className="font-semibold">Deactivation failed</div>
                <div className="mt-1 text-xs text-black/60 dark:text-white/60">
                  {deactivateError}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deactivateBusy}
              onClick={async () => {
                if (!walletClient?.account?.address) {
                  setDeactivateError(
                    "Wallet not ready. Reconnect and try again."
                  );
                  return;
                }
                try {
                  setDeactivateError(null);
                  setDeactivateBusy(true);

                  // Withdraw all USDC held by the Safe back to the connected wallet.
                  const {
                    publicClient,
                    safeAddress: safe,
                    smartAccountClient,
                  } = await getSafeSmartAccountClient({ walletClient });

                  const usdc = getUsdcAddressForChain(targetChain.id);
                  const bal = await publicClient.readContract({
                    address: usdc,
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [safe],
                  });
                  if (bal <= 0n) {
                    setDeactivateError("Vault has no USDC to withdraw.");
                    return;
                  }

                  const calldata = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [walletClient.account.address as Address, bal],
                  });

                  const userOpHash = await smartAccountClient.sendUserOperation(
                    {
                      calls: [{ to: usdc, value: 0n, data: calldata }],
                    }
                  );
                  await smartAccountClient.waitForUserOperationReceipt({
                    hash: userOpHash,
                  });

                  // Show success toast
                  const withdrawAmount = formatUsdcFromMicros(bal);
                  toast.success(
                    `Successfully withdrew ${withdrawAmount.toFixed(
                      6
                    )} USDC from vault!`,
                    {
                      position: "top-right",
                      autoClose: 5000,
                    }
                  );

                  setDeactivateOpen(false);

                  await Promise.all([
                    refreshBalances(safe),
                    refreshDeposits(safe),
                  ]);
                } catch (e) {
                  const msg =
                    e instanceof Error ? e.message : "Deactivation failed.";
                  setDeactivateError(msg);

                  // Show error toast
                  toast.error(`Withdrawal failed: ${msg}`, {
                    position: "top-right",
                    autoClose: 7000,
                  });
                } finally {
                  setDeactivateBusy(false);
                }
              }}
            >
              {deactivateBusy ? "Deactivating…" : "Deactivate Arbiter"}
            </button>

            <button
              type="button"
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deactivateBusy}
              onClick={() => setDeactivateOpen(false)}
            >
              Cancel
            </button>
          </div>
        </Modal>

        <DeployVaultModal
          open={editPolicyOpen}
          onClose={() => setEditPolicyOpen(false)}
          editMode={true}
          editSafeAddress={safeAddress as Address | undefined}
          onDeployVault={async () => {
            // Not used in edit mode
            return safeAddress;
          }}
          onSelectAgent={() => {
            // Optional callback
          }}
          onSaveRules={() => {
            // Optional callback
          }}
        />
      </main>
    </div>
  );
}
