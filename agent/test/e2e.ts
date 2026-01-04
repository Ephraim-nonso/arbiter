import assert from "node:assert/strict";
import { fetchDefiLlamaPools } from "../src/tools/yields.js";
import { readProofGateState } from "../src/tools/proofGateState.js";
import { optimizeAllocations } from "../src/tools/optimize.js";
import { proveWithNode } from "../src/tools/prove.js";
import { buildExecuteWithProofTx, sendAgentTx } from "../src/tools/tx.js";
import { optionalEnv, requireEnv } from "./_env.js";

/**
 * End-to-end test (optional chain write):
 * 1) Read ProofGateSafeModule state (policyHash + nonce)
 * 2) Fetch yields and compute a valid allocation vector
 * 3) Prove with current nonce/policy constraints
 * 4) Ensure proof policyHash matches on-chain policyHash
 * 5) Build executeWithProof calldata
 * 6) Optionally submit tx (DRY_RUN=true skips submission)
 *
 * Requirements (agent/.env):
 * - RPC_URL
 * - SAFE_ADDRESS
 * - PROOF_GATE_SAFE_MODULE
 * - AGENT_PRIVATE_KEY (required unless DRY_RUN=true)
 */
async function main() {
  const rpcUrl = requireEnv("RPC_URL");
  const safe = requireEnv("SAFE_ADDRESS");
  const module = requireEnv("PROOF_GATE_SAFE_MODULE");
  const dryRun = (optionalEnv("DRY_RUN") ?? "false").toLowerCase() === "true";

  const agentAddress = optionalEnv("AGENT_ADDRESS"); // optional: improves diagnostics

  const state = await readProofGateState({
    rpcUrl,
    proofGateModule: module,
    safeAddress: safe,
    agentAddress,
  });

  console.log("onchain:", state);

  assert.notEqual(state.policyHash, "0x0000000000000000000000000000000000000000000000000000000000000000");

  // For now, we test against a fixed policy. This MUST match the Safe's configured policyHash.
  const allowBitmap = 1;
  const capsBpsCsv = "10000,0,0,0,0";

  const pools = await fetchDefiLlamaPools({ chain: "Mantle", stableHint: "USDC", topK: 7 });
  const plan = await optimizeAllocations({ pools, allowBitmap, capsBpsCsv });

  const proof = await proveWithNode({
    safe,
    nonce: Number(state.nonce),
    deadline: 0,
    allowBitmap,
    capsBpsCsv,
    allocationsCsv: plan.allocationsCsv,
  });

  // Important: proof policy hash must match on-chain module policy hash.
  // proveWithNode returns `policyHash` as a string (from zk script).
  // The on-chain is bytes32 hex (0x...).
  // We compare by normalizing both to lower case hex.
  const onchain = String(state.policyHash).toLowerCase();
  const offchain = String(proof.policyHash).toLowerCase();
  if (onchain !== offchain) {
    throw new Error(
      `POLICY_HASH_MISMATCH: onchain=${onchain} offchain=${offchain}. ` +
        `Update allowBitmap/capsBps to match the Safe's configured policy.`
    );
  }

  const tx = await buildExecuteWithProofTx({
    proofGateModule: module,
    safeAddress: safe,
    proofA: proof.a,
    proofB: proof.b,
    proofC: proof.c,
    publicInputs: proof.publicInputs,
  });

  console.log("built tx:", {
    to: tx.to,
    calldataBytes: (tx.data.length - 2) / 2,
    allocationsCsv: plan.allocationsCsv,
    nonce: state.nonce,
  });

  if (dryRun) {
    console.log("DRY_RUN=true; skipping send.");
    return;
  }

  // Send tx (requires AGENT_PRIVATE_KEY in env)
  const { hash } = await sendAgentTx({
    rpcUrl,
    to: tx.to,
    data: tx.data,
  });
  console.log("sent:", { hash });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


