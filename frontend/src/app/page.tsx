import { SiteHeader } from "@/components/SiteHeader";
import Image from "next/image";
import { ProtocolApr } from "@/components/ProtocolAprs";
import { HomeHeroCta } from "@/components/HomeHeroCta";
import { AgniTokenBreakdown } from "@/components/AgniTokenBreakdown";
import { OndoTokenBreakdown } from "@/components/OndoTokenBreakdown";
import { InitTokenBreakdown } from "@/components/InitTokenBreakdown";
import { StargateTokenBreakdown } from "@/components/StargateTokenBreakdown";
import { PendleTokenBreakdown } from "@/components/PendleTokenBreakdown";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
      <SiteHeader />

      <main className="mx-auto flex w-full min-h-[calc(100vh-84px)] flex-col px-6 pb-12 pt-4 sm:px-10 lg:px-40">
        <div className="grid flex-1 grid-cols-1 items-center gap-10 pt-6 lg:grid-cols-12">
          {/* Left / Hero */}
          <section className="lg:col-span-4">
            <p className="text-sm font-medium text-black/60 dark:text-white/60">
              Set your rules. Let agents chase yield—provably.
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl">
              Proof‑gated yield automation on Mantle.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-black/70 dark:text-white/70">
              Create a vault, pick your allowed protocols, and cap exposure per
              protocol. Rebalances execute only when a zero‑knowledge proof
              shows the agent stayed within your policy.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <div>
                <HomeHeroCta />
              </div>
            </div>
          </section>

          {/* Center / Visual */}
          <section className="lg:col-span-5">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-[640px] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/15 dark:bg-black">
              <Image
                src="/hero-robot-trading.svg"
                alt="Robot thinking about trading activity"
                fill
                priority
                className="object-cover"
              />
            </div>
          </section>

          {/* Right / Protocol list */}
          <aside className="lg:col-span-3">
            <div className="grid grid-cols-2 gap-4">
              <ProtocolCard
                name="Ondo"
                apr={<ProtocolApr protocolKey="ondo" />}
                children={<OndoTokenBreakdown />}
              />
              <ProtocolCard
                name="AGNI"
                apr={<ProtocolApr protocolKey="agni" />}
                children={<AgniTokenBreakdown />}
              />
              <ProtocolCard
                name="Stargate"
                apr={<ProtocolApr protocolKey="stargate" />}
                children={<StargateTokenBreakdown />}
              />
              <ProtocolCard
                name="Pendle"
                apr={<ProtocolApr protocolKey="pendle" />}
                children={<PendleTokenBreakdown />}
              />
              <ProtocolCard
                name="INIT"
                apr={<ProtocolApr protocolKey="init" />}
                className="col-span-2"
                children={<InitTokenBreakdown />}
              />
            </div>
            <p className="mt-5 text-xs leading-5 text-black/50 dark:text-white/50">
              You’ll pick which protocols the agent can use. Execution is
              proof‑gated and routed only to allowlisted targets.
            </p>
          </aside>
        </div>

        {/* Lower content to reduce “empty bottom” and make the homepage feel complete */}
        <section className="mt-auto rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-black sm:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <Feature
              title="User-defined policy"
              body="Choose allowed protocols and set per-protocol caps. Your policy is committed on-chain as a hash."
            />
            <Feature
              title="Agent proposes, ZK proves"
              body="Agents generate a Groth16 proof that the proposal respects your allowlist, caps, and feasibility rules."
            />
            <Feature
              title="On-chain enforced execution"
              body="Execution routes only to allowlisted protocol targets. If the proof is invalid, the Safe won’t execute."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ProtocolCard({
  name,
  apr,
  className,
  children,
}: {
  name: string;
  apr: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition",
        "dark:border-white/15 dark:bg-black",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/5 text-xs font-semibold text-black dark:bg-white/10 dark:text-white">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold">{name}</div>
            <div className="mt-0.5 text-xs text-black/60 dark:text-white/60">
              
            </div>
          </div>
        </div>
        <div className="h-5 w-10 rounded-full bg-lime-400/30 dark:bg-lime-400/20" />
      </div>
      {children}
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold tracking-tight">{title}</div>
      <div className="text-sm leading-6 text-black/70 dark:text-white/70">
        {body}
      </div>
    </div>
  );
}
