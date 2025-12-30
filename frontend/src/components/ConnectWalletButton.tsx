"use client";

import { useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { mantle } from "@/lib/chains";
import { isWalletConnectEnabled } from "@/lib/wagmi";

function shortAddr(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWalletButton({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending, error } = useConnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [open, setOpen] = useState(false);

  const mantleMismatch = isConnected && chainId !== mantle.id;

  const btnClass =
    variant === "primary"
      ? "inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
      : "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10";

  const label = useMemo(() => {
    if (!isConnected) return "Connect Wallet";
    if (mantleMismatch) return isSwitching ? "Switching…" : "Switch to Mantle";
    return shortAddr(address);
  }, [address, isConnected, mantleMismatch, isSwitching]);

  function onClick() {
    if (!isConnected) return setOpen(true);
    if (mantleMismatch) return switchChain({ chainId: mantle.id });
    // connected + correct chain => open menu
    return setOpen(true);
  }

  return (
    <div className="relative">
      <button type="button" className={[btnClass, className ?? ""].join(" ")} onClick={onClick}>
        {isPending ? "Connecting…" : label}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-72 rounded-2xl border border-black/10 bg-white p-3 shadow-lg dark:border-white/15 dark:bg-black">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm font-semibold">Wallet</div>
            <button
              type="button"
              className="cursor-pointer rounded-md px-2 py-1 text-xs text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          {!isConnected ? (
            <div className="mt-2 space-y-2">
              {connectors
                .filter((c) => (isWalletConnectEnabled ? true : c.id !== "walletConnect"))
                .map((c) => (
                  <button
                    key={c.uid}
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
                    onClick={() => {
                      connect({ connector: c });
                      setOpen(false);
                    }}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-black/50 dark:text-white/50">Connect</span>
                  </button>
                ))}
              {error ? (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error.message}
                </div>
              ) : null}
              {!isWalletConnectEnabled ? (
                <div className="px-1 pt-1 text-[11px] leading-4 text-black/50 dark:text-white/50">
                  WalletConnect is disabled. Set <code>NEXT_PUBLIC_WC_PROJECT_ID</code> to enable it.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="rounded-xl border border-black/10 px-3 py-2 text-xs text-black/70 dark:border-white/15 dark:text-white/70">
                <div className="font-semibold">Connected</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="shrink-0 text-black/60 dark:text-white/60">Address:</span>
                  <span
                    className="min-w-0 flex-1 truncate font-mono"
                    title={address}
                  >
                    {shortAddr(address)}
                  </span>
                </div>
                <div className="mt-1">Chain: {chainId}</div>
              </div>
              <button
                type="button"
                className="w-full cursor-pointer rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}


