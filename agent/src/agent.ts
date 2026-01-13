import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import { z } from "zod";

import {
  fetchDefiLlamaPools,
  fetchDefiLlamaPoolsMetadata,
} from "./tools/yields.js";
import { proveWithNode, proveWithNodeMetadata } from "./tools/prove.js";
import {
  buildExecuteWithProofTx,
  buildExecuteWithProofTxMetadata,
  sendAgentTx,
  sendAgentTxMetadata,
} from "./tools/tx.js";
import {
  readProofGateState,
  readProofGateStateMetadata,
} from "./tools/proofGateState.js";
import {
  optimizeAllocations,
  optimizeAllocationsMetadata,
} from "./tools/optimize.js";
import {
  buildRouterCalls,
  buildRouterCallsMetadata,
} from "./tools/routerCalls.js";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required in agent/.env`);
  return v;
}

async function main() {
  const modelName = process.env.OLLAMA_MODEL || "mistral-nemo";
  const llm = new ChatOllama({ model: modelName });

  const systemPrompt = `You are Arbiter, a trading agent that must obey user policy constraints.

You MUST use tools to:
- read ProofGateSafeModule state (policyHash + nonce)
- fetch yield data
- compute a valid allocation vector (sum=10000, <= caps, zero for disallowed protocols)
- generate a Groth16 proof
- build and submit ProofGateSafeModule.executeWithProof

Never invent on-chain state. Always call the tools. If the generated proof's policyHash does not match the on-chain policyHash, STOP and explain the mismatch.`;

  const responseFormat = z.object({
    summary: z.string(),
    allocationBps: z.tuple([
      z.number().int(),
      z.number().int(),
      z.number().int(),
      z.number().int(),
      z.number().int(),
    ]),
    allowBitmap: z.number().int(),
    capsBpsCsv: z.string(),
    allocationsCsv: z.string(),
    onchainPolicyHash: z.string(),
    usedNonce: z.string(),
    txHash: z.string().optional(),
  });

  const agent = createAgent({
    model: llm as unknown as Parameters<typeof createAgent>[0]["model"],
    systemPrompt,
    responseFormat,
    checkpointer: new MemorySaver(),
    tools: [
      tool(fetchDefiLlamaPools, fetchDefiLlamaPoolsMetadata),
      tool(readProofGateState, readProofGateStateMetadata),
      tool(optimizeAllocations, optimizeAllocationsMetadata),
      tool(buildRouterCalls, buildRouterCallsMetadata),
      tool(proveWithNode, proveWithNodeMetadata),
      tool(buildExecuteWithProofTx, buildExecuteWithProofTxMetadata),
      tool(sendAgentTx, sendAgentTxMetadata),
    ],
  });

  const SAFE_ADDRESS = requireEnv("SAFE_ADDRESS");
  const PROOF_GATE_SAFE_MODULE = requireEnv("PROOF_GATE_SAFE_MODULE");
  const RPC_URL = requireEnv("RPC_URL");
  const AGENT_PRIVATE_KEY = requireEnv("AGENT_PRIVATE_KEY"); // used by sendAgentTx tool via env

  // NOTE: We still keep "caps/allowBitmap" explicit until we wire policy setting in frontend.
  // These MUST match the Safe's configured policyHash, otherwise proof submission will fail.
  const allowBitmap = 1;
  const capsBpsCsv = "10000,0,0,0,0";

  const config = {
    configurable: { thread_id: "arbiter" },
    // In the doc pattern, tool runtime context can carry user_id etc. We'll extend this for multi-user later.
    context: { safe: SAFE_ADDRESS },
  } as const;

  const userMessage = `Execute one optimize+prove+submit cycle.

Inputs:
- rpcUrl: ${RPC_URL}
- proofGateModule: ${PROOF_GATE_SAFE_MODULE}
- safeAddress: ${SAFE_ADDRESS}
- allowBitmap: ${allowBitmap}
- capsBpsCsv: ${capsBpsCsv}
- deadline: 0

Required steps (tool calls):
1) readProofGateState to get on-chain policyHash and nonce for the safe (and agentEnabled if possible).
2) fetchDefiLlamaPools(chain="Mantle", stableHint="USDC", topK=7)
3) optimizeAllocations(pools, allowBitmap, capsBpsCsv) => allocationsCsv
4) buildRouterCalls(allocationsBps, allowBitmap, safeAddress) => calls array
5) proveWithNode(vault=safe, nonce=onchainNonce, deadline=0, allowBitmap, capsBpsCsv, allocationsCsv)
6) If proveOutput.policyHash != onchain policyHash: STOP.
7) buildExecuteWithProofTx(proofGateModule, safe, proof elements, publicInputs, calls)
8) sendAgentTx(to=proofGateModule, data=calldata)

Output must be structured per responseFormat.`;

  const out = await agent.invoke(
    {
      messages: [{ role: "user", content: userMessage }],
    },
    config
  );

  // eslint-disable-next-line no-console
  console.log(out.structuredResponse);

  // Hint to the agent tools: we keep the key in env; tool call will use it.
  // (The agent will only use it if it chooses to call sendAgentTx)
  void AGENT_PRIVATE_KEY;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
