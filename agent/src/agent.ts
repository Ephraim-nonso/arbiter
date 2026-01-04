import { ChatOllama } from "@langchain/ollama";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";

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

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required in agent/.env`);
  return v;
}

async function main() {
  const modelName = process.env.OLLAMA_MODEL || "mistral-nemo";
  const llm = new ChatOllama({ model: modelName });

  const tools = [
    tool(fetchDefiLlamaPools, fetchDefiLlamaPoolsMetadata),
    tool(proveWithNode, proveWithNodeMetadata),
    tool(buildExecuteWithProofTx, buildExecuteWithProofTxMetadata),
    tool(sendAgentTx, sendAgentTxMetadata),
  ];

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: new MemorySaver(),
  });

  // Default prompt: a full end-to-end "optimize -> prove -> build tx -> (optionally) send tx".
  // IMPORTANT: Router calls are empty for now; this still exercises proof gating and nonce flow.
  const SAFE_ADDRESS = requireEnv("SAFE_ADDRESS");
  const PROOF_GATE_SAFE_MODULE = requireEnv("PROOF_GATE_SAFE_MODULE");
  const RPC_URL = requireEnv("RPC_URL");
  const AGENT_PRIVATE_KEY = requireEnv("AGENT_PRIVATE_KEY");

  const prompt = `
You are Arbiter, a reasoning agent that optimizes USDC allocations subject to user policy constraints.

Goal: produce and submit a ProofGateSafeModule.executeWithProof transaction for the user's Safe on Mantle Sepolia.

Constraints:
- Use allowBitmap=1 (only protocolId 0 allowed) for now.
- Use capsBps "10000,0,0,0,0".
- Use allocations "10000,0,0,0,0".
- Nonce should be assumed 0 for the first run (later we will read it from-chain).
- Deadline can be 0 (no deadline).

Steps:
1) Fetch top pools on Mantle for USDC (just for context).
2) Generate the Groth16 proof with proveWithNode.
3) Build the executeWithProof tx with buildExecuteWithProofTx.
4) Submit it with sendAgentTx.

Inputs:
- safeAddress: ${SAFE_ADDRESS}
- proofGateModule: ${PROOF_GATE_SAFE_MODULE}
- rpcUrl: ${RPC_URL}
`;

  const out = await agent.invoke(
    {
      messages: [new HumanMessage(prompt)],
    },
    { configurable: { thread_id: "arbiter" } }
  );

  // Print final message
  const last = out.messages[out.messages.length - 1];
  // eslint-disable-next-line no-console
  console.log(last.content);

  // Hint to the agent tools: we keep the key in env; tool call will use it.
  // (The agent will only use it if it chooses to call sendAgentTx)
  void AGENT_PRIVATE_KEY;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


