"use client";

export function FundAgentForm({
  depositAmount,
  onChangeDepositAmount,
  onPrimary,
  primaryLabel,
  primaryVariant = "secondary",
}: {
  depositAmount: string;
  onChangeDepositAmount: (v: string) => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryVariant?: "primary" | "secondary";
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-black">
        <div className="mt-2 space-y-2">
          <div className="text-xs text-black/60 dark:text-white/60">
            From network
          </div>

          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/80 shadow-sm dark:border-white/15 dark:bg-black dark:text-white/80"
            onClick={() => {}}
            aria-disabled="true"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-xs font-bold text-black dark:border-white/15 dark:bg-black dark:text-white">
                M
              </div>
              <div>Mantle</div>
            </div>
            <svg
              className="h-5 w-5 text-black/40 dark:text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="flex items-center justify-between text-xs text-black/60 dark:text-white/60">
            <div>Using</div>
            <div>Amount</div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/15 dark:bg-black">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-xs font-bold text-black dark:border-white/15 dark:bg-black dark:text-white">
                $
              </div>
              <div className="text-sm font-semibold text-black/80 dark:text-white/80">
                USDC
              </div>
            </div>

            <div className="flex-1" />

            <input
              inputMode="decimal"
              placeholder="0"
              value={depositAmount}
              onChange={(e) => onChangeDepositAmount(e.target.value)}
              className="w-28 bg-transparent text-right text-sm font-semibold text-black/90 outline-none placeholder:text-black/30 dark:text-white/90 dark:placeholder:text-white/30"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-black/50 dark:text-white/50">
            <div>
              Min. deposit: <span className="font-semibold">$10</span>{" "}
              <span className="text-black/35 dark:text-white/35">(≈10 USDC)</span>
            </div>
            <div>
              Balance:{" "}
              <span className="font-semibold text-black/70 dark:text-white/70">
                --
              </span>{" "}
              USDC
            </div>
          </div>

          <div className="rounded-2xl border border-lime-400/25 bg-lime-400/10 px-4 py-3 text-xs leading-5 text-black/70 dark:border-lime-400/20 dark:text-white/70">
            Mantle native token needed for gas fee to deposit. Agent will handle
            gas fees for trading activities afterwards
          </div>

          <button
            type="button"
            className={[
              "inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-5 text-sm font-semibold transition",
              primaryVariant === "primary"
                ? "bg-lime-400 text-black shadow-sm hover:bg-lime-300"
                : "bg-black/10 text-black/60 hover:bg-black/15 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15",
            ].join(" ")}
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


