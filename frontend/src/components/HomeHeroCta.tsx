"use client";

import { useState } from "react";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { mantle } from "@/lib/chains";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { DeployVaultModal } from "@/components/DeployVaultModal";
import { deploySafe4337 } from "@/lib/safeDeploy";

export function HomeHeroCta() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const mantleMismatch = isConnected && chainId !== mantle.id;
  const [deployOpen, setDeployOpen] = useState(false);

  if (!isConnected) {
    return <ConnectWalletButton variant="primary" className="h-11 px-5" />;
  }

  if (mantleMismatch) {
    return (
      <button
        type="button"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
        onClick={() => switchChain({ chainId: mantle.id })}
      >
        {isSwitching ? "Switching…" : "Switch to Mantle"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
        onClick={() => setDeployOpen(true)}
      >
        Deploy vault
      </button>

      <DeployVaultModal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        onDeployVault={async () => {
          if (!walletClient) throw new Error("Wallet not ready. Try again.");
          const { safeAddress } = await deploySafe4337({ walletClient });
          return safeAddress;
        }}
        onSelectAgent={(agent) => {
          // placeholder: later we persist this to a vault policy/agent config
          alert(`Agent selected: ${agent}`);
        }}
        onSaveRules={(rules) => {
          // placeholder: later this compiles to policy + stores policyHash on-chain
          alert(`Rules saved:\n${JSON.stringify(rules, null, 2)}`);
        }}
      />
    </>
  );
}
