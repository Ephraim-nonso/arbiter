import {
  createPublicClient,
  encodeFunctionData,
  http,
  type Address,
} from "viem";
import { targetChain } from "@/lib/wagmi";
import { getSafeSmartAccountClient } from "./safeDeploy";
import type { WalletClient } from "viem";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";

// ProofGateSafeModule ABI
const PROOF_GATE_ABI = [
  {
    inputs: [
      { name: "newPolicyHash", type: "bytes32", internalType: "bytes32" },
    ],
    name: "setPolicyHash",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agent", type: "address", internalType: "address" },
      { name: "enabled", type: "bool", internalType: "bool" },
    ],
    name: "setAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "safe", type: "address", internalType: "address" }],
    name: "policyHashOf",
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "safe", type: "address", internalType: "address" },
      { name: "agent", type: "address", internalType: "address" },
    ],
    name: "agentEnabled",
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type PolicyConfig = {
  style: string;
  diversification: string;
  activity: string;
  protection: string;
  venues: string[];
  noLeverage: boolean;
  agentType: string;
};

/**
 * Calculate policy hash from user selections.
 * This encodes all policy parameters into a deterministic hash.
 *
 * The policy hash is computed as keccak256 of the ABI-encoded policy parameters.
 */
export function calculatePolicyHash(config: PolicyConfig): `0x${string}` {
  // ABI-encode the policy parameters
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "string style, string diversification, string activity, string protection, string[] venues, bool noLeverage, string agentType"
    ),
    [
      config.style,
      config.diversification,
      config.activity,
      config.protection,
      config.venues,
      config.noLeverage,
      config.agentType,
    ]
  );

  // Hash the encoded parameters
  return keccak256(encoded);
}

/**
 * Get the ProofGateSafeModule address from environment.
 */
function getProofGateModuleAddress(): Address {
  const addr = process.env.NEXT_PUBLIC_PROOF_GATE_SAFE_MODULE_ADDRESS;
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    throw new Error(
      "NEXT_PUBLIC_PROOF_GATE_SAFE_MODULE_ADDRESS is not set or invalid. " +
        "Add it to frontend/.env (see env.example)."
    );
  }
  return addr as Address;
}

/**
 * Get the agent EOA address from environment.
 *
 * Agents are EOA (Externally Owned Account) addresses controlled by private keys.
 * The agent type (conservative/balanced/aggressive) is just a policy configuration,
 * not a different agent. All users enable the same agent EOA, but with different
 * policy hashes that encode their preferences.
 *
 * In production, this would be the Arbiter service's agent wallet address.
 */
function getAgentAddress(): Address {
  const addr = process.env.NEXT_PUBLIC_AGENT_ADDRESS;

  if (addr && addr.startsWith("0x") && addr.length === 42) {
    return addr as Address;
  }

  throw new Error(
    `Agent address not configured. Please set NEXT_PUBLIC_AGENT_ADDRESS in frontend/.env. ` +
      `Example: NEXT_PUBLIC_AGENT_ADDRESS=0x... (the agent EOA wallet address that will call executeWithProof).`
  );
}

/**
 * Configure ProofGateSafeModule for a Safe:
 * 1. Set the policy hash (encodes agent type preferences + policy rules)
 * 2. Enable the agent EOA
 *
 * Both operations are executed via Safe transactions (UserOperations).
 * The agent type (conservative/balanced/aggressive) is encoded in the policy hash,
 * not as a separate agent address - all users enable the same agent EOA.
 */
export async function configureProofGateModule({
  walletClient,
  safeAddress,
  policyConfig,
  agentType,
}: {
  walletClient: WalletClient;
  safeAddress: Address;
  policyConfig: PolicyConfig;
  agentType: string; // Used for policy hash calculation, but all users enable the same agent EOA
}): Promise<void> {
  const moduleAddress = getProofGateModuleAddress();
  const agentAddress = getAgentAddress(); // Single agent EOA for all users
  const policyHash = calculatePolicyHash(policyConfig);

  const { smartAccountClient } = await getSafeSmartAccountClient({
    walletClient,
  });

  // Step 1: Set policy hash via Safe transaction
  const setPolicyHashData = encodeFunctionData({
    abi: PROOF_GATE_ABI,
    functionName: "setPolicyHash",
    args: [policyHash],
  });

  // Step 2: Enable agent EOA via Safe transaction
  const setAgentData = encodeFunctionData({
    abi: PROOF_GATE_ABI,
    functionName: "setAgent",
    args: [agentAddress, true],
  });

  // Execute both operations in a single UserOperation for gas efficiency
  const userOpHash = await smartAccountClient.sendUserOperation({
    calls: [
      {
        to: moduleAddress,
        value: BigInt(0),
        data: setPolicyHashData,
      },
      {
        to: moduleAddress,
        value: BigInt(0),
        data: setAgentData,
      },
    ],
  });

  await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });
}

/**
 * Get the agent EOA address.
 * Used to check if the agent is enabled for a Safe.
 */
export function getAgentAddressForType(): Address | null {
  try {
    return getAgentAddress();
  } catch {
    return null;
  }
}

/**
 * Check if the agent is enabled for a Safe.
 */
export async function checkAgentEnabled(safeAddress: Address): Promise<{
  agentAddress: Address | null;
  enabled: boolean;
}> {
  const moduleAddress = getProofGateModuleAddress();
  const publicClient = createPublicClient({
    chain: targetChain,
    transport: http(targetChain.rpcUrls.default.http[0]),
  });

  const agentAddr = getAgentAddressForType();
  if (!agentAddr) {
    return { agentAddress: null, enabled: false };
  }

  try {
    const enabled = (await publicClient.readContract({
      address: moduleAddress,
      abi: PROOF_GATE_ABI,
      functionName: "agentEnabled",
      args: [safeAddress, agentAddr],
    })) as boolean;

    return { agentAddress: agentAddr, enabled };
  } catch {
    return { agentAddress: agentAddr, enabled: false };
  }
}

/**
 * Check if ProofGateSafeModule is configured for a Safe.
 */
export async function checkProofGateConfig(safeAddress: Address): Promise<{
  policyHash: `0x${string}` | null;
  agentEnabled: boolean;
  agentAddress: Address | null;
}> {
  const moduleAddress = getProofGateModuleAddress();
  const publicClient = createPublicClient({
    chain: targetChain,
    transport: http(targetChain.rpcUrls.default.http[0]),
  });

  const policyHash = (await publicClient.readContract({
    address: moduleAddress,
    abi: PROOF_GATE_ABI,
    functionName: "policyHashOf",
    args: [safeAddress],
  })) as `0x${string}`;

  const { agentAddress, enabled } = await checkAgentEnabled(safeAddress);

  return {
    policyHash:
      policyHash ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
        ? null
        : policyHash,
    agentEnabled: enabled,
    agentAddress,
  };
}

/**
 * Update ProofGateSafeModule configuration:
 * - Update policy hash (policy changes when user changes agent type or rules)
 * - Enable/disable agent EOA if needed (but typically just stays enabled)
 *
 * Note: All users enable the same agent EOA. The "agent type" is encoded in
 * the policy hash, not as a separate agent address.
 */
export async function updateProofGateConfig({
  walletClient,
  safeAddress,
  policyConfig,
}: {
  walletClient: WalletClient;
  safeAddress: Address;
  policyConfig: PolicyConfig;
}): Promise<void> {
  const moduleAddress = getProofGateModuleAddress();
  const { smartAccountClient } = await getSafeSmartAccountClient({
    walletClient,
  });

  // Update policy hash with new configuration
  const policyHash = calculatePolicyHash(policyConfig);
  const setPolicyHashData = encodeFunctionData({
    abi: PROOF_GATE_ABI,
    functionName: "setPolicyHash",
    args: [policyHash],
  });

  // Execute policy hash update via Safe transaction
  const userOpHash = await smartAccountClient.sendUserOperation({
    calls: [
      {
        to: moduleAddress,
        value: BigInt(0),
        data: setPolicyHashData,
      },
    ],
  });

  await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });
}
