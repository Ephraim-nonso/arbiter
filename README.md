### Arbiter — ZK‑Proof‑Gated AI Yield Optimizer on Mantle

Arbiter is a Mantle‑native **yield optimization system** where a user’s **vault is a Safe smart account** (a smart contract wallet). Users deposit stablecoins into that smart account, define a policy, and allow an AI agent to allocate funds across a curated protocol allowlist — **but only when each action is accompanied by a valid ZK proof**.

At a high level:

- **Users** deploy a Safe “vault”, deposit USDC (or a mock token in test), and configure their policy.
- **Users** deploy a Safe “vault”, deposit USDC, and configure their policy.
- **The agent** reasons about the best yield opportunities and proposes allocations.
- **ZK proofs** bind the agent’s actions to the user’s policy (allowlist + caps + allocation constraints).
- **On-chain enforcement** is done by a Safe Module (`ProofGateSafeModule`) which verifies the proof before executing the Router batch.

---

### Why this redefines yield on Mantle

Most “yield optimizers” rely on off-chain trust (the agent won’t exceed caps, won’t touch a bad protocol, won’t change strategy unexpectedly). Arbiter flips that model:

- **The agent can be powerful and autonomous**, but it’s **cryptographically sandboxed**.
- The user policy is **committed on-chain** (as a `policyHash`), and **every execution must prove compliance**.
- That makes it safe to combine:
  - fast iteration (LLM reasoning + tool calls),
  - dynamic market data (protocol yields),
  - and strict, auditable enforcement (ZK + Safe module).

---

### Core architecture (how it works)

#### 1) Safe smart account vault (user account)

Each user vault is a **Safe smart account**. In Arbiter, the **vault = the smart account**:

- **Custody**: the Safe holds the user’s deposited assets (e.g., USDC).
- **Accounting**: the dashboard reads balances against the Safe address.
- **Execution boundary**: all agent-driven actions execute _from the Safe_ (via a Safe module), so the user’s funds never leave the vault unless the Router calls do so under policy constraints.

#### 2) Router (protocol execution entrypoint)

The Router is the only contract the Safe module executes. It provides:

- a **protocol target registry** (mapping targets → `protocolId`)
- `executeWithAllowBitmap(allowBitmap, calls)` which enforces allowlisting at call-time

#### 3) ProofGateSafeModule (ZK‑proof gate)

This is a Safe module installed/enabled on the user Safe.

- Safe owners set:
  - `policyHash` (a commitment to the policy)
  - `agent` allowlist (which agent EOAs are allowed to trigger execution)
- The agent calls:
  - `executeWithProof(safe, calls, proof, publicInputs)`
- The module checks:
  - agent is allowlisted
  - `publicInputs` bind the Safe + nonce + deadline + allowBitmap
  - proof verifies against the Groth16 verifier
  - then executes Router via `execTransactionFromModule(...)`

#### 4) ZK policy circuit (what the proof enforces)

The circuit enforces:

- allocations sum to **10000 bps**
- each allocation is **≤ cap** for that protocol
- allocations are **0 for non-allowlisted protocols**
- caps are **0 for non-allowlisted protocols** (prevents “hidden” off-chain caps)
- the `policyHash` is bound to `(allowBitmap, capsBps[])` via Poseidon

This makes the agent’s optimization “safe”: it can optimize within the feasible region, but cannot exit it.

#### 5) Reasoning agent (LLM + tools)

The agent is built using LangChain. It:

- fetches yield data (MVP: DefiLlama yields dataset),
- computes a valid allocation plan,
- generates a Groth16 proof (via the repo prover script),
- builds the `executeWithProof` transaction,
- (optionally) submits it as the agent EOA once allowlisted by the Safe.

---

### Repo map (quick navigation)

- **Frontend (Next.js + wagmi/viem)**: [`frontend/`](./frontend)
  - Deploy vault / manage vault, deposit UX, dashboard
- **Smart contracts (Foundry)**: [`contracts/`](./contracts)
  - Router, ProofGateSafeModule, verifiers, deploy scripts, tests
- **ZK circuits + prover (circom + snarkjs)**: [`zk/`](./zk)
  - `policy.circom`, Groth16 setup artifacts, prover script
- **Reasoning agent (LangChain + Safe Protocol Kit)**: [`agent/`](./agent)
  - tools (yields, on-chain reads, optimize, prove, tx build/send) + test harness

---

### Protocol set (MVP allowlist)

Arbiter uses a fixed protocol vector (N=5) that must stay consistent across:

- ZK circuit: [`zk/circuits/policy.circom`](./zk/circuits/policy.circom)
- Contracts: [`contracts/src/libraries/ProtocolIds.sol`](./contracts/src/libraries/ProtocolIds.sol)
- Agent optimizer: [`agent/src/tools/optimize.ts`](./agent/src/tools/optimize.ts)

Assignments:

- 0 = Ondo
- 1 = AGNI
- 2 = Stargate
- 3 = Mantle Rewards
- 4 = INIT

---

### Tooling & frameworks used

#### LLM reasoning / agent

- **LangChain (JS/TS)** for agent orchestration and tool calling
- **LangGraph memory** for conversation state / checkpointing
- **Ollama** (local) model integration (configurable; can be swapped)
- **Safe Protocol Kit** for Safe integrations (expandable for Safe‑tx / human approval flows)

#### ZK proof stack

- **Circom** for circuit definition (`policy.circom`)
- **snarkjs** for Groth16 setup + proving
- **Poseidon** hash inside circuit (and computed in JS for the prover)

#### Smart contracts

- **Solidity** + **Foundry** for development/testing/scripts
- **Safe contracts/modules** for Safe account and module integration
- **Account abstraction** components (Safe4337) are available in the contracts workspace

#### Frontend

- **Next.js** app
- **wagmi + viem** for wallet + contract interactions

---

### Quick start (high level)

#### 1) Deploy contracts (testnet)

From [`contracts/`](./contracts):

- Deploy Router + verifier + adapter + ProofGate module (see scripts in `contracts/script/`)

#### 2) Build ZK artifacts

From [`zk/`](./zk):

- Run `./scripts/build_groth16.sh`

#### 3) Configure & run frontend

From [`frontend/`](./frontend):

- copy `env.example` to `.env` and set:
  - bundler/paymaster endpoints (for Safe deployment via 4337)
  - USDC address
  - ProofGate module address (to enable on Safe deploy)

#### 4) Run the agent tests

From [`agent/`](./agent):

- configure `agent/.env`
- run `npm run test:smoke` (no chain write) and `npm run test:e2e`

---

### Docker (reproducible agent tests)

If you want to run the agent smoke/e2e tests in a consistent environment (Node 20 + pinned deps), use Docker Compose.

1. Create a **repo-root** `.env` (same folder as `docker-compose.yml`) with at least:

- `SAFE_ADDRESS=0x...`
- `PROOF_GATE_SAFE_MODULE=0x...`

Optional (for e2e):

- `RPC_URL=https://rpc.testnet.mantle.xyz`
- `AGENT_PRIVATE_KEY=0x...`
- `DRY_RUN=true`

2. Run smoke:

```bash
docker compose run --rm agent-test
```

3. Run e2e:

```bash
docker compose run --rm -e DRY_RUN=true agent-test npm run test:e2e
docker compose run --rm -e DRY_RUN=false agent-test npm run test:e2e
```

---

### Notes / current state

- The agent currently proves + submits `executeWithProof` with **empty Router calls** until protocol adapters / targets are finalized.
- The frontend supports:
  - Safe vault deployment
  - USDC deposits and deposit history timestamps (for accurate dashboard display)
