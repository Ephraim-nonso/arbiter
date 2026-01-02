"use client";

import { ArbiterLogo } from "@/components/ArbiterLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MantleIcon } from "@/components/MantleIcon";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full items-center justify-between px-6 py-5 sm:px-10 lg:px-40">
      <div className="flex items-center gap-6">
        <ArbiterLogo />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-sm font-medium text-black shadow-sm transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
          aria-label="Network selector"
          title="Network selector"
        >
          <span className="text-black dark:text-white">
            <MantleIcon size={18} />
          </span>
          <span className="text-sm">Mantle</span>
          <span className="text-black/40 dark:text-white/40">USDC</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <ThemeToggle />
        <ConnectWalletButton />
      </div>
    </header>
  );
}


