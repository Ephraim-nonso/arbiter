# Arbiter Rust Agent (MVP)

This is the off-chain agent service that:
- fetches pool APR/APY data (MVP: DefiLlama yields),
- plans a target allocation within the user's policy (allowlist + per-protocol caps),
- generates a Groth16 proof via the existing `zk/scripts/prove.mjs` prover,
- submits `ProofGateSafeModule.executeWithProof(...)` for a user's Safe (ERC-4337).

## Status

MVP scaffold is in place. Execution adapters + on-chain submission are TODO.

## Run (planner only, for now)

```bash
cd agent-rs
cargo run -- --top-k 7
```

## Env (coming next)

- `LLAMA_POOLS_URL` (optional): override DefiLlama pools endpoint
- `MANTLE_RPC_URL`: Mantle RPC for reading Safe/module state
- `PROOF_GATE_MODULE`: ProofGateSafeModule address (once deployed)
- `ROUTER`: Router address (once deployed/configured)
- `AGENT_PRIVATE_KEY`: agent EOA key (or signer config)
- `ZK_PROVER_CMD`: optional override for prover invocation

## Protocol IDs

Must match:
- `zk/circuits/policy.circom`
- `contracts/src/libraries/ProtocolIds.sol`

0 = Ondo  
1 = AGNI  
2 = Stargate  
3 = Mantle Rewards  
4 = INIT  


