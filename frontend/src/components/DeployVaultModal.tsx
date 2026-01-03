"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { FundAgentForm } from "@/components/FundAgentForm";
import { targetChain } from "@/lib/wagmi";

type AgentType = "conservative" | "balanced" | "aggressive";
type Step =
  | "creating"
  | "created"
  | "deposit"
  | "chooseAgent"
  | "rules"
  | "activate";

type ProtocolKey = "ondo" | "agni" | "stargate" | "mantle-rewards" | "init";
type StyleKey = "safe" | "balanced" | "maxYield" | "custom";
type DiversificationKey = "spread" | "normal" | "focused";
type ActivityKey = "calm" | "normal" | "fast";
type ProtectionKey = "strict" | "standard" | "loose";

const PROTOCOLS: Array<{ key: ProtocolKey; name: string }> = [
  { key: "ondo", name: "Ondo" },
  { key: "agni", name: "AGNI" },
  { key: "stargate", name: "Stargate" },
  { key: "mantle-rewards", name: "Mantle Rewards" },
  { key: "init", name: "INIT" },
];

const STYLE_PRESETS: Record<Exclude<StyleKey, "custom">, ProtocolKey[]> = {
  safe: ["ondo", "mantle-rewards"],
  balanced: ["ondo", "init", "mantle-rewards"],
  maxYield: ["ondo", "agni", "stargate", "mantle-rewards", "init"],
};

function titleCase(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function venueNames(keys: ProtocolKey[]) {
  const byKey = new Map(PROTOCOLS.map((p) => [p.key, p.name]));
  return keys.map((k) => byKey.get(k) ?? k);
}

const AGENTS: Array<{
  id: AgentType;
  name: string;
  tagline: string;
  bullets: string[];
}> = [
  {
    id: "conservative",
    name: "Conservative",
    tagline: "Stable-first",
    bullets: [
      "Allocates among stable yield venues (e.g., lending stablecoin markets).",
      "Low turnover, strict exposure caps, no volatile assets.",
      "Rebalance if APY delta > X or utilization changes.",
    ],
  },
  {
    id: "balanced",
    name: "Balanced",
    tagline: "Core + small risk budget",
    bullets: [
      "Majority in stable yield; small allocation to blue-chip volatile strategies.",
      "Volatile bucket ≤ 10–25%, no leverage.",
      "Policy caps + allowlist still enforced.",
    ],
  },
  {
    id: "aggressive",
    name: "Aggressive",
    tagline: "Higher turnover / higher risk budget",
    bullets: [
      "Rotates more frequently among higher-yield pools.",
      "Higher caps + higher turnover allowed (still policy-bounded).",
      "No protocol execution unless allowlisted.",
    ],
  },
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function shortAddr(a: string) {
  if (!a.startsWith("0x") || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; sublabel?: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={[
                "cursor-pointer rounded-2xl border px-3 py-2 text-left transition",
                active
                  ? "border-lime-400/50 bg-lime-400/10"
                  : "border-black/10 bg-white hover:bg-black/5 dark:border-white/15 dark:bg-black dark:hover:bg-white/10",
              ].join(" ")}
              onClick={() => onChange(o.value)}
            >
              <div className="text-sm font-semibold">{o.label}</div>
              {o.sublabel ? (
                <div className="mt-0.5 text-[11px] leading-4 text-black/50 dark:text-white/50">
                  {o.sublabel}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DeployVaultModal({
  open,
  onClose,
  onDeployVault,
  onSelectAgent,
  onSaveRules,
}: {
  open: boolean;
  onClose: () => void;
  onDeployVault?: () => Promise<string | void> | string | void;
  onSelectAgent?: (agent: AgentType) => void;
  onSaveRules?: (rules: {
    style: StyleKey;
    diversification: DiversificationKey;
    activity: ActivityKey;
    protection: ProtectionKey;
    venues: ProtocolKey[];
    noLeverage: true;
  }) => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("creating");
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("conservative");
  const [busy, setBusy] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [deployedSafe, setDeployedSafe] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // rules step state
  const [style, setStyle] = useState<StyleKey>("balanced");
  const [diversification, setDiversification] =
    useState<DiversificationKey>("normal");
  const [activity, setActivity] = useState<ActivityKey>("normal");
  const [protection, setProtection] = useState<ProtectionKey>("standard");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customVenues, setCustomVenues] = useState<
    Record<ProtocolKey, boolean>
  >({
    ondo: true,
    agni: false,
    stargate: false,
    "mantle-rewards": true,
    init: true,
  });

  const effectiveVenues: ProtocolKey[] = useMemo(() => {
    if (style === "custom") {
      return PROTOCOLS.map((p) => p.key).filter((k) => !!customVenues[k]);
    }
    return STYLE_PRESETS[style];
  }, [customVenues, style]);

  const title = useMemo(() => {
    if (step === "creating") return "Deploy vault";
    if (step === "created") return "Vault created";
    if (step === "deposit") return "Fund your Agent";
    if (step === "chooseAgent") return "Set your agent";
    return "Set your agent rules";
  }, [step]);

  useEffect(() => {
    if (!open) return;
    // reset flow each time it opens
    setStep("creating");
    setSelectedAgent("conservative");
    setBusy(false);
    setAdvancedOpen(false);
    setDepositAmount("");
    setDeployedSafe(null);
    setDeployError(null);

    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const maybeAddr =
          typeof onDeployVault === "function"
            ? await onDeployVault()
            : onDeployVault;
        if (typeof maybeAddr === "string") setDeployedSafe(maybeAddr);
        if (!onDeployVault) await sleep(1200);
        if (cancelled) return;
        setStep("created");
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error ? e.message : "Failed to deploy account.";
        setDeployError(msg);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, onDeployVault]);

  // Initialize rule preset when user picks the "agent type"
  useEffect(() => {
    // conservative -> safe, balanced -> balanced, aggressive -> maxYield
    if (selectedAgent === "conservative") setStyle("safe");
    if (selectedAgent === "balanced") setStyle("balanced");
    if (selectedAgent === "aggressive") setStyle("maxYield");
  }, [selectedAgent]);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {step === "creating" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Spinner />
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">
              Creating vault…
            </div>
          </div>
          <div className="text-sm leading-6 text-black/60 dark:text-white/60">
            This will deploy your Safe-based smart account + vault wiring. You
            can close this modal and retry if it takes too long.
          </div>
          {deployError ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-black/80 dark:text-white/80">
                <div className="font-semibold">Deployment failed</div>
                <div className="mt-1 text-xs text-black/60 dark:text-white/60">
                  {deployError}
                </div>
                <div className="mt-2 text-[11px] text-black/50 dark:text-white/50">
                  Tip: ensure `NEXT_PUBLIC_BUNDLER_RPC_URL` and
                  `NEXT_PUBLIC_PAYMASTER_RPC_URL` are set in your frontend env.
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
                onClick={() => {
                  // simplest retry: close/reopen
                  onClose();
                }}
              >
                Close and retry
              </button>
            </div>
          ) : (
            <div className="text-xs text-black/40 dark:text-white/40">
              {busy ? "Working…" : " "}
            </div>
          )}
        </div>
      ) : null}

      {step === "created" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm text-black/80 dark:border-lime-400/20 dark:text-white/80">
            <div className="font-semibold">Vault created successfully.</div>
            <div className="mt-1 text-sm text-black/60 dark:text-white/60">
              Next, deposit USDC to fund the agent.
            </div>
            {deployedSafe ? (
              <div className="mt-2 text-xs text-black/60 dark:text-white/60">
                Safe:{" "}
                <a
                  href={`${
                    targetChain.blockExplorers?.default.url ?? ""
                  }/address/${deployedSafe}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-mono text-black/80 underline underline-offset-4 hover:text-black dark:text-white/80 dark:hover:text-white"
                  title="View on explorer"
                >
                  {shortAddr(deployedSafe)}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M14 3h7v7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 14L21 3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
            onClick={() => setStep("deposit")}
          >
            Proceed to deposit
          </button>
        </div>
      ) : null}

      {step === "deposit" ? (
        <FundAgentForm
          depositAmount={depositAmount}
          onChangeDepositAmount={setDepositAmount}
          primaryLabel="Continue to Personalization"
          primaryVariant="secondary"
          onPrimary={() => setStep("chooseAgent")}
        />
      ) : null}

      {step === "chooseAgent" ? (
        <div className="space-y-4">
          <div className="text-sm leading-6 text-black/60 dark:text-white/60">
            Choose an agent profile. Your policy (allowlist + caps) is still
            enforced by ZK proofs on every execution.
          </div>

          <div className="space-y-2">
            {AGENTS.map((a) => {
              const active = selectedAgent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  className={[
                    "w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition",
                    active
                      ? "border-lime-400/50 bg-lime-400/10"
                      : "border-black/10 bg-white hover:bg-black/5 dark:border-white/15 dark:bg-black dark:hover:bg-white/10",
                  ].join(" ")}
                  onClick={() => setSelectedAgent(a.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{a.name}</div>
                      <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                        {a.tagline}
                      </div>
                    </div>
                    <div
                      className={[
                        "mt-0.5 h-5 w-5 rounded-full border",
                        active
                          ? "border-lime-400 bg-lime-400"
                          : "border-black/20 dark:border-white/25",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-black/60 dark:text-white/60">
                    {a.bullets.map((b) => (
                      <li key={b}>- {b}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
              onClick={() => {
                onSelectAgent?.(selectedAgent);
                setStep("rules");
              }}
            >
              Set agent
            </button>
            <button
              type="button"
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "rules" ? (
        <div className="space-y-5">
          {/* Style */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Choose a style</div>
            <div className="space-y-2">
              {(
                [
                  {
                    key: "safe",
                    label: "Safe",
                    desc: "Stable yield, minimal risk",
                  },
                  {
                    key: "balanced",
                    label: "Balanced",
                    desc: "Stable yield + limited growth",
                  },
                  {
                    key: "maxYield",
                    label: "Max Yield",
                    desc: "Highest yield, more volatility",
                  },
                  ...(style === "custom"
                    ? [
                        {
                          key: "custom",
                          label: "Custom",
                          desc: "Custom venue set",
                        },
                      ]
                    : []),
                ] as Array<{ key: StyleKey; label: string; desc: string }>
              ).map((o) => {
                const active = style === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={[
                      "w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-lime-400/50 bg-lime-400/10"
                        : "border-black/10 bg-white hover:bg-black/5 dark:border-white/15 dark:bg-black dark:hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => setStyle(o.key)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{o.label}</div>
                        <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                          {o.desc}
                        </div>
                      </div>
                      <div
                        className={[
                          "mt-0.5 h-5 w-5 rounded-full border",
                          active
                            ? "border-lime-400 bg-lime-400"
                            : "border-black/20 dark:border-white/25",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/15 dark:bg-black">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-black/70 dark:text-white/70">
                  <span className="font-semibold text-black dark:text-white">
                    Venues used:
                  </span>{" "}
                  {venueNames(effectiveVenues).join(", ")}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black dark:border-white/15 dark:bg-black dark:text-white">
                  <span className="inline-block h-2 w-2 rounded-full bg-lime-400" />
                  No leverage (verified)
                  <span className="ml-1 rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-black/70 dark:border-white/15 dark:text-white/70">
                    locked
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sliders */}
          <Segmented
            label="Diversification"
            value={diversification}
            onChange={(v) => setDiversification(v as DiversificationKey)}
            options={[
              { value: "spread", label: "Spread", sublabel: "Max venue 30%" },
              { value: "normal", label: "Normal", sublabel: "Max venue 50%" },
              { value: "focused", label: "Focused", sublabel: "Max venue 80%" },
            ]}
          />

          <Segmented
            label="Activity"
            value={activity}
            onChange={(v) => setActivity(v as ActivityKey)}
            options={[
              { value: "calm", label: "Calm", sublabel: "1–2x/week" },
              { value: "normal", label: "Normal", sublabel: "Daily" },
              { value: "fast", label: "Fast", sublabel: "Multiple/day" },
            ]}
          />

          {/* Protection */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Trade protection</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "strict", label: "Strict", pct: "0.5%" },
                  { key: "standard", label: "Standard", pct: "1.0%" },
                  { key: "loose", label: "Loose", pct: "2.0%" },
                ] as Array<{ key: ProtectionKey; label: string; pct: string }>
              ).map((o) => {
                const active = protection === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={[
                      "cursor-pointer rounded-2xl border px-3 py-2 text-left transition",
                      active
                        ? "border-lime-400/50 bg-lime-400/10"
                        : "border-black/10 bg-white hover:bg-black/5 dark:border-white/15 dark:bg-black dark:hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => setProtection(o.key)}
                  >
                    <div className="text-sm font-semibold">{o.label}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-black/50 dark:text-white/50">
                      {o.pct}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-xs leading-5 text-black/50 dark:text-white/50">
              Stricter is safer but may rebalance less often.
            </div>
          </div>

          {/* Advanced */}
          <div className="rounded-2xl border border-black/10 bg-white dark:border-white/15 dark:bg-black">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <div>
                <div className="text-sm font-semibold">
                  Advanced: pick venues
                </div>
                <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                  Optional protocol checklist
                </div>
              </div>
              <div className="text-xs text-black/50 dark:text-white/50">
                {advancedOpen ? "Hide" : "Show"}
              </div>
            </button>

            {advancedOpen ? (
              <div className="space-y-2 px-4 pb-4">
                {PROTOCOLS.map((p) => (
                  <label
                    key={p.key}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-black"
                  >
                    <span className="font-medium">{p.name}</span>
                    <input
                      type="checkbox"
                      checked={!!customVenues[p.key]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCustomVenues((prev) => ({
                          ...prev,
                          [p.key]: checked,
                        }));
                        setStyle("custom");
                      }}
                    />
                  </label>
                ))}
                <div className="text-xs text-black/50 dark:text-white/50">
                  {style === "custom" ? "Custom venue set" : " "}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer summary + save */}
          <div className="space-y-3">
            <div className="text-sm text-black/70 dark:text-white/70">
              <span className="font-semibold text-black dark:text-white">
                Summary:
              </span>{" "}
              {titleCase(style === "maxYield" ? "Max Yield" : style)} •{" "}
              {titleCase(diversification)} • {titleCase(activity)} •{" "}
              {titleCase(protection)} protection • No leverage
            </div>

            <button
              type="button"
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
              onClick={async () => {
                try {
                  setBusy(true);
                  if (onSaveRules) {
                    await onSaveRules({
                      style,
                      diversification,
                      activity,
                      protection,
                      venues: effectiveVenues,
                      noLeverage: true,
                    });
                  } else {
                    await sleep(600);
                    alert("Rules saved (placeholder).");
                  }
                  setStep("activate");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save rules"}
            </button>

            <button
              type="button"
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
              onClick={() => setStep("chooseAgent")}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {step === "activate" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70 dark:border-white/15 dark:bg-black dark:text-white/70">
            <div className="font-semibold text-black/90 dark:text-white/90">
              Activate Agent
            </div>
            <div className="mt-1 text-sm text-black/60 dark:text-white/60">
              Next: enable the agent + proof-gated execution (placeholder).
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-lime-400 px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300"
            onClick={onClose}
          >
            Done
          </button>

          <button
            type="button"
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
            onClick={() => setStep("rules")}
          >
            Back
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
