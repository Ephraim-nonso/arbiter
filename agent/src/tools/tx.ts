import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepoliaTestnet } from "viem/chains";
import type { RouterCall } from "./routerCalls.js";

// Minimal ABI for ProofGateSafeModule.executeWithProof
const proofGateAbi = [
  {
    type: "function",
    name: "executeWithProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "safe", type: "address" },
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
      { name: "proof", type: "bytes" },
      { name: "publicInputs", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

function asAddress(a: string): Address {
  if (!a.startsWith("0x") || a.length !== 42) throw new Error(`Bad address: ${a}`);
  return a as Address;
}

function parseU256Array(values: string[]): bigint[] {
  return values.map((v) => {
    // prover returns decimal strings
    const n = BigInt(v);
    if (n < 0n) throw new Error("publicInputs must be unsigned");
    return n;
  });
}

export async function buildExecuteWithProofTx({
  proofGateModule,
  safeAddress,
  proofA,
  proofB,
  proofC,
  publicInputs,
  calls = [],
}: {
  proofGateModule: string;
  safeAddress: string;
  proofA: [string, string];
  proofB: [[string, string], [string, string]];
  proofC: [string, string];
  publicInputs: string[];
  calls?: RouterCall[];
}) {
  // Match contracts/test/SafeProofGate.t.sol encoding:
  // proofBytes = abi.encode(uint256[2] a, uint256[2][2] b, uint256[2] c)
  const proofBytes = encodeAbiParameters(
    [
      { name: "a", type: "uint256[2]" },
      { name: "b", type: "uint256[2][2]" },
      { name: "c", type: "uint256[2]" },
    ],
    [
      [BigInt(proofA[0]), BigInt(proofA[1])],
      [
        [BigInt(proofB[0][0]), BigInt(proofB[0][1])],
        [BigInt(proofB[1][0]), BigInt(proofB[1][1])],
      ],
      [BigInt(proofC[0]), BigInt(proofC[1])],
    ]
  );

  // Convert RouterCall[] to the format expected by the ABI
  const routerCalls = calls.map((call) => ({
    target: call.target,
    value: call.value,
    data: call.data,
  }));

  const data = encodeFunctionData({
    abi: proofGateAbi,
    functionName: "executeWithProof",
    args: [
      asAddress(safeAddress),
      routerCalls, // Router.Call[]
      proofBytes,
      parseU256Array(publicInputs),
    ],
  });

  return {
    to: asAddress(proofGateModule),
    value: 0n,
    data,
  };
}

export const buildExecuteWithProofTxMetadata = {
  name: "buildExecuteWithProofTx",
  description:
    "Build a transaction that calls ProofGateSafeModule.executeWithProof(safe, calls[], proofBytes, publicInputs). " +
    "The calls parameter should be built using buildRouterCalls based on allocations.",
  schema: z.object({
    proofGateModule: z.string(),
    safeAddress: z.string(),
    proofA: z.tuple([z.string(), z.string()]),
    proofB: z.tuple([
      z.tuple([z.string(), z.string()]),
      z.tuple([z.string(), z.string()]),
    ]),
    proofC: z.tuple([z.string(), z.string()]),
    publicInputs: z.array(z.string()),
    calls: z
      .array(
        z.object({
          target: z.string(),
          value: z.string().optional(),
          data: z.string(),
        })
      )
      .optional()
      .describe("Router.Call[] array (optional, defaults to empty). Use buildRouterCalls to generate based on allocations."),
  }),
};

export async function sendAgentTx({
  rpcUrl,
  privateKey,
  to,
  data,
  value = "0",
}: {
  rpcUrl?: string;
  privateKey?: string;
  to: string;
  data: `0x${string}`;
  value?: string;
}) {
  const resolvedRpcUrl = rpcUrl || process.env.RPC_URL;
  const resolvedPrivateKey = privateKey || process.env.AGENT_PRIVATE_KEY;
  if (!resolvedRpcUrl) throw new Error("rpcUrl is required (or set RPC_URL in env).");
  if (!resolvedPrivateKey) throw new Error("privateKey is required (or set AGENT_PRIVATE_KEY in env).");

  const account = privateKeyToAccount(resolvedPrivateKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain: mantleSepoliaTestnet,
    transport: http(resolvedRpcUrl),
  });
  const publicClient = createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(resolvedRpcUrl),
  });

  const hash = await walletClient.sendTransaction({
    to: asAddress(to),
    data,
    value: BigInt(value),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

export const sendAgentTxMetadata = {
  name: "sendAgentTx",
  description:
    "Send an EOA transaction (agent wallet) on Mantle Sepolia. Use for calling ProofGateSafeModule.executeWithProof.",
  schema: z.object({
    rpcUrl: z.string().optional().describe("Optional; defaults to RPC_URL env var."),
    privateKey: z.string().optional().describe("Optional; defaults to AGENT_PRIVATE_KEY env var."),
    to: z.string(),
    data: z.string().startsWith("0x"),
    value: z.string().default("0"),
  }),
};


