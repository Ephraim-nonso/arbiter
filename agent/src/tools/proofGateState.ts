import { z } from "zod";
import { createPublicClient, http, type Address } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";

const proofGateReadAbi = [
  {
    type: "function",
    name: "policyHashOf",
    stateMutability: "view",
    inputs: [{ name: "safe", type: "address" }],
    outputs: [{ name: "policyHash", type: "bytes32" }],
  },
  {
    type: "function",
    name: "nonceOf",
    stateMutability: "view",
    inputs: [{ name: "safe", type: "address" }],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
  {
    type: "function",
    name: "agentEnabled",
    stateMutability: "view",
    inputs: [
      { name: "safe", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [{ name: "enabled", type: "bool" }],
  },
] as const;

function asAddress(a: string): Address {
  if (!a.startsWith("0x") || a.length !== 42) throw new Error(`Bad address: ${a}`);
  return a as Address;
}

export async function readProofGateState({
  rpcUrl,
  proofGateModule,
  safeAddress,
  agentAddress,
}: {
  rpcUrl?: string;
  proofGateModule: string;
  safeAddress: string;
  agentAddress?: string;
}) {
  const resolvedRpcUrl = rpcUrl || process.env.RPC_URL;
  if (!resolvedRpcUrl) throw new Error("rpcUrl is required (or set RPC_URL in env).");

  const publicClient = createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(resolvedRpcUrl),
  });

  const policyHash = await publicClient.readContract({
    address: asAddress(proofGateModule),
    abi: proofGateReadAbi,
    functionName: "policyHashOf",
    args: [asAddress(safeAddress)],
  });

  const nonce = await publicClient.readContract({
    address: asAddress(proofGateModule),
    abi: proofGateReadAbi,
    functionName: "nonceOf",
    args: [asAddress(safeAddress)],
  });

  const agentEnabled =
    agentAddress && agentAddress.startsWith("0x") && agentAddress.length === 42
      ? await publicClient.readContract({
          address: asAddress(proofGateModule),
          abi: proofGateReadAbi,
          functionName: "agentEnabled",
          args: [asAddress(safeAddress), asAddress(agentAddress)],
        })
      : null;

  return {
    policyHash,
    nonce: nonce.toString(),
    agentEnabled,
  };
}

export const readProofGateStateMetadata = {
  name: "readProofGateState",
  description:
    "Read ProofGateSafeModule state for a Safe: policyHashOf(safe), nonceOf(safe), and optionally agentEnabled(safe, agent).",
  schema: z.object({
    rpcUrl: z.string().optional(),
    proofGateModule: z.string(),
    safeAddress: z.string(),
    agentAddress: z.string().optional(),
  }),
};


