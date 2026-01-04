# Arbiter Reasoning Agent (LangChain + Safe Protocol Kit)

This is a TypeScript agent that:

- pulls yield data (DefiLlama pools),
- reasons about an allocation (bounded by policy inputs you provide),
- reads on-chain `policyHash` + `nonce` from `ProofGateSafeModule`,
- generates a Groth16 proof by calling the existing prover (`../zk/scripts/prove.mjs`),
- builds a `ProofGateSafeModule.executeWithProof(...)` transaction,
- submits the transaction as the agent EOA (must be allowlisted).

Safe reference: [Safe “Setup an AI agent”](https://docs.safe.global/home/ai-agent-setup).

## About dependencies

LangChain’s install guide recommends Node.js 20+ and shows installing `langchain` + `@langchain/core` ([docs](https://docs.langchain.com/oss/javascript/langchain/install)).
In this repo we use the **modular packages** directly (`@langchain/core`, `@langchain/langgraph`, `@langchain/community`) which is fully compatible with the current LangChain JS ecosystem.

This repo also uses the current agent API style from the LangChain docs:

- [Quickstart](https://docs.langchain.com/oss/javascript/langchain/quickstart)
- [Agents](https://docs.langchain.com/oss/javascript/langchain/agents)

## Setup

```bash
cd agent
cp env.example .env
npm install
```

Then run:

```bash
npm run dev
```

## Tests (recommended before Router integrations)

### Smoke (no chain write)

Generates a proof and builds calldata locally:

```bash
cd agent
npm run test:smoke
```

### End-to-end (optional chain write)

Reads on-chain `policyHash/nonce`, proves, builds calldata, and **optionally broadcasts** the tx:

```bash
cd agent
DRY_RUN=true npm run test:e2e   # no broadcast
DRY_RUN=false npm run test:e2e  # broadcast (requires AGENT_PRIVATE_KEY)
```

**Prereqs for e2e broadcast to succeed**:

- `ProofGateSafeModule` is enabled on the Safe
- `policyHash` is set on-chain for the Safe (`setPolicyHash` from the Safe)
- the agent EOA is allowlisted (`setAgent(agent, true)` from the Safe)
- the `allowBitmap` + `capsBpsCsv` used by the test matches what was used to set the Safe's policy hash

## Notes

- The agent submits a normal EOA transaction to `ProofGateSafeModule.executeWithProof(...)`.
- Safe Protocol Kit is included for Safe introspection / future Safe-tx flows (policy/agent enablement).
- For now, Router calls are left empty in the tool (you can extend it to include protocol actions once Router integrations are ready).
