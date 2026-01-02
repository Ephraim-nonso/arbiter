"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useSwitchChain, useWalletClient } from "wagmi";
import { useRouter } from "next/navigation";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { DeployVaultModal } from "@/components/DeployVaultModal";
import { deploySafe4337 } from "@/lib/safeDeploy";
import { targetChain } from "@/lib/wagmi";

export function HomeHeroCta() {
  const { status, chainId, address } = useConnection();
  const isConnected = status === "connected";
  const switchChain = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();

  const mantleMismatch = isConnected && chainId !== targetChain.id;
  const [deployOpen, setDeployOpen] = useState(false);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [loadingSafe, setLoadingSafe] = useState(false);

  const owner = useMemo(
    () => (address ? address.toLowerCase() : null),
    [address]
  );

  useEffect(() => {
    if (!isConnected || mantleMismatch || !owner) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingSafe(true);
        const res = await fetch(
          `/api/safe?chainId=${encodeURIComponent(
            String(targetChain.id)
          )}&owner=${encodeURIComponent(owner)}`
        );
        const json = (await res.json()) as { safeAddress?: string | null };
        if (cancelled) return;
        setSafeAddress(json.safeAddress ?? null);
      } catch {
        if (!cancelled) setSafeAddress(null);
      } finally {
        if (!cancelled) setLoadingSafe(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, mantleMismatch, owner]);

  if (!isConnected) {
    return <ConnectWalletButton variant="primary" className="h-11 px-5" />;
  }

  if (mantleMismatch) {
    return (
      <button
        type="button"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
        onClick={() => switchChain.mutate({ chainId: targetChain.id })}
      >
        {switchChain.isPending ? "Switching…" : `Switch to ${targetChain.name}`}
      </button>
    );
  }

  const primaryLabel = loadingSafe
    ? "Loading…"
    : safeAddress
    ? "Manage vault"
    : "Deploy vault";

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
        onClick={() => {
          if (loadingSafe) return;
          if (safeAddress) return router.push("/vault");
          return setDeployOpen(true);
        }}
        disabled={loadingSafe}
      >
        {primaryLabel}
      </button>

      <DeployVaultModal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        onDeployVault={async () => {
          // If we already have a stored Safe for this (chainId, EOA), treat this as "Manage".
          if (safeAddress) return safeAddress;

          if (!walletClient) throw new Error("Wallet not ready. Try again.");
          const { safeAddress: deployed } = await deploySafe4337({
            walletClient,
          });

          // Persist mapping (chainId, owner) -> safeAddress on our simple backend.
          if (owner) {
            await fetch("/api/safe", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                chainId: targetChain.id,
                owner,
                safeAddress: deployed,
              }),
            }).catch(() => {});
          }

          setSafeAddress(deployed);
          return deployed;
        }}
        onSelectAgent={() => {
          // TODO placeholder: later we persist this to a vault policy/agent config
        }}
        onSaveRules={() => {
          // TODO placeholder: later this compiles to policy + stores policyHash on-chain
        }}
      />
    </>
  );
}
