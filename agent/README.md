# Arbiter Reasoning Agent (LangChain + Safe Protocol Kit)

This replaces the old `agent-rs` MVP with a TypeScript agent that:

- pulls yield data (DefiLlama pools),
- reasons about an allocation (bounded by policy inputs you provide),
- generates a Groth16 proof by calling the existing prover (`../zk/scripts/prove.mjs`),
- builds a `ProofGateSafeModule.executeWithProof(...)` transaction,
- optionally submits the transaction as the agent EOA.

Safe reference: [Safe “Setup an AI agent”](https://docs.safe.global/home/ai-agent-setup).

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

## Notes

- The agent submits a normal EOA transaction to `ProofGateSafeModule.executeWithProof(...)`.
- Safe Protocol Kit is included for Safe introspection / future Safe-tx flows (policy/agent enablement).
- For now, Router calls are left empty in the tool (you can extend it to include protocol actions once adapters are ready).


