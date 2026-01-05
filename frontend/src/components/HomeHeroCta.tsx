"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useSwitchChain, useWalletClient } from "wagmi";
import { useRouter } from "next/navigation";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { DeployVaultModal } from "@/components/DeployVaultModal";
import { deploySafe4337 } from "@/lib/safeDeploy";
import { targetChain } from "@/lib/wagmi";
import { getSafeAccount } from "@/lib/safeDeploy";

export function HomeHeroCta() {
  const { status, chainId, address } = useConnection();
  const isConnected = status === "connected";
  const switchChain = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();

  const mantleMismatch = isConnected && chainId !== targetChain.id;
  const [deployOpen, setDeployOpen] = useState(false);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [safeDeployed, setSafeDeployed] = useState(false);
  const [loadingSafe, setLoadingSafe] = useState(false);

  const owner = useMemo(
    () => (address ? address.toLowerCase() : null),
    [address]
  );

  useEffect(() => {
    if (!isConnected || mantleMismatch || !owner) return;
    if (!walletClient) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingSafe(true);
        // Safe address is deterministic for (owner, saltNonce). Compute it locally (no backend needed).
        const { publicClient, safeAddress: addr } = await getSafeAccount({
          walletClient,
        });
        const bytecode = await publicClient.getBytecode({ address: addr });
        if (cancelled) return;
        setSafeAddress(addr);
        setSafeDeployed(!!bytecode && bytecode !== "0x");
      } catch {
        if (!cancelled) {
          setSafeAddress(null);
          setSafeDeployed(false);
        }
      } finally {
        if (!cancelled) setLoadingSafe(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, mantleMismatch, owner, walletClient]);

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
    : safeDeployed
    ? "Manage vault"
    : "Deploy vault";

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
        onClick={() => {
          if (loadingSafe) return;
          // The dashboard can still compute the counterfactual address, but
          // "Manage" implies the Safe has been deployed on-chain.
          if (safeDeployed) return router.push("/vault");
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
          if (!walletClient) throw new Error("Wallet not ready. Try again.");
          const { safeAddress: deployed } = await deploySafe4337({
            walletClient,
          });

          setSafeAddress(deployed);
          setSafeDeployed(true);
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
