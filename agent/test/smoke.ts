import assert from "node:assert/strict";
import { fetchDefiLlamaPools } from "../src/tools/yields.js";
import { proveWithNode } from "../src/tools/prove.js";
import { buildExecuteWithProofTx } from "../src/tools/tx.js";
import { requireEnv } from "./_env.js";

/**
 * Smoke test: proves + builds calldata without hitting the chain.
 *
 * Requirements:
 * - SAFE_ADDRESS
 * - PROOF_GATE_SAFE_MODULE (only used to build tx `to`)
 */
async function main() {
  const safe = requireEnv("SAFE_ADDRESS");
  const module = requireEnv("PROOF_GATE_SAFE_MODULE");

  // Fetch pools (just ensures external fetch + parsing works)
  const pools = await fetchDefiLlamaPools({ chain: "Mantle", stableHint: "USDC", topK: 3 });
  assert.ok(pools.length >= 0);

  // Use known-good defaults (must match your on-chain policy to pass real e2e).
  const nonce = 0;
  const deadline = 0;
  const allowBitmap = 1;
  const capsBpsCsv = "10000,0,0,0,0";
  const allocationsCsv = "10000,0,0,0,0";

  const proof = await proveWithNode({
    safe,
    nonce,
    deadline,
    allowBitmap,
    capsBpsCsv,
    allocationsCsv,
  });
  assert.equal(Array.isArray(proof.publicInputs), true);
  assert.equal(proof.publicInputs.length >= 5, true);

  const tx = await buildExecuteWithProofTx({
    proofGateModule: module,
    safeAddress: safe,
    proofA: proof.a,
    proofB: proof.b,
    proofC: proof.c,
    publicInputs: proof.publicInputs,
  });

  assert.ok(tx.to.startsWith("0x"));
  assert.ok(tx.data.startsWith("0x"));
  console.log("smoke ok:", {
    pools: pools.length,
    policyHash: proof.policyHash,
    calldataBytes: (tx.data.length - 2) / 2,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


