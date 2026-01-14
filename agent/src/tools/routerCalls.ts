import { z } from "zod";
import { encodeFunctionData, type Address } from "viem";

/**
 * Protocol IDs must match:
 * - contracts/src/libraries/ProtocolIds.sol
 * - zk/circuits/policy.circom
 */
export const PROTOCOL_IDS = {
  ONDO: 0,
  AGNI: 1,
  STARGATE: 2,
  MANTLE_REWARDS: 3,
  INIT: 4,
} as const;

/**
 * Pendle Market address on Mantle mainnet.
 * This is the simpler interface for Pendle swaps (swapSyForExactPt).
 * Reference: https://mantlescan.xyz/token/0x7dc07C575A0c512422dCab82CE9Ed74dB58Be30C#code
 */
const PENDLE_MARKET_MAINNET =
  "0x7dc07C575A0c512422dCab82CE9Ed74dB58Be30C" as Address;

/**
 * Protocol contract addresses on Mantle (mainnet or Sepolia).
 * These must be registered in the Router via setTargetsProtocolId.
 *
 * For Mantle Sepolia, these may need to be different addresses.
 * Load from environment or configure per network.
 */
function getProtocolAddresses(): Record<number, Address | null> {
  // Try to load from environment first
  const envAddresses: Record<string, string | undefined> = {
    ONDO_TARGET: process.env.ONDO_TARGET,
    AGNI_TARGET: process.env.AGNI_TARGET,
    STARGATE_TARGET: process.env.STARGATE_TARGET,
    MANTLE_REWARDS_TARGET: process.env.MANTLE_REWARDS_TARGET,
    INIT_TARGET: process.env.INIT_TARGET,
  };

  // Default addresses for Mantle mainnet (from RouterProtocolIntegration.t.sol)
  // These can be overridden via environment variables
  const defaults: Record<number, Address> = {
    [PROTOCOL_IDS.ONDO]:
      "0x05Be26527e817998A7206475496FDe1e68957c5a" as Address, // ONDO_USDY (from ConfigureRouter.s.sol)
    [PROTOCOL_IDS.AGNI]:
      "0x319B69888b0d11cEC22caA5034e25FfFBDc88421" as Address, // AGNI_SWAP_ROUTER
    [PROTOCOL_IDS.STARGATE]:
      "0x0000000000000000000000000000000000000000" as Address, // TODO: Add Stargate address
    [PROTOCOL_IDS.MANTLE_REWARDS]: PENDLE_MARKET_MAINNET, // PENDLE_MARKET (simpler interface)
    [PROTOCOL_IDS.INIT]:
      "0x0000000000000000000000000000000000000000" as Address, // TODO: Add INIT address
  };

  const result: Record<number, Address | null> = {};
  for (const [protocolId, defaultAddr] of Object.entries(defaults)) {
    const pid = Number(protocolId);
    const envKey = Object.keys(envAddresses).find((k) => {
      const id = k.replace("_TARGET", "").toUpperCase();
      return (
        (id === "ONDO" && pid === PROTOCOL_IDS.ONDO) ||
        (id === "AGNI" && pid === PROTOCOL_IDS.AGNI) ||
        (id === "STARGATE" && pid === PROTOCOL_IDS.STARGATE) ||
        (id === "MANTLE_REWARDS" && pid === PROTOCOL_IDS.MANTLE_REWARDS) ||
        (id === "INIT" && pid === PROTOCOL_IDS.INIT)
      );
    });
    const envAddr = envKey ? envAddresses[envKey] : undefined;
    result[pid] =
      (envAddr && envAddr.startsWith("0x")
        ? (envAddr as Address)
        : defaultAddr) || null;
  }
  return result;
}

/**
 * Router.Call struct type
 */
export type RouterCall = {
  target: Address;
  value: bigint;
  data: `0x${string}`;
};

/**
 * Build Router calls based on allocations.
 *
 * For each protocol with a non-zero allocation, creates a Router.Call.
 *
 * NOTE: This is a basic implementation. In production, you would:
 * - Build actual protocol-specific function calls (deposit, swap, etc.)
 * - Calculate amounts based on Safe balance and allocation percentages
 * - Handle protocol-specific parameters (slippage, deadlines, etc.)
 *
 * For now, this creates placeholder calls that can be extended with actual protocol integrations.
 */
export async function buildRouterCalls({
  allocationsBps,
  allowBitmap,
  safeAddress,
  totalAmount,
}: {
  allocationsBps: number[]; // [0..4] array, sum=10000
  allowBitmap: number;
  safeAddress: string;
  totalAmount?: bigint; // Optional: total USDC amount to allocate
}): Promise<RouterCall[]> {
  if (allocationsBps.length !== 5) {
    throw new Error("allocationsBps must have exactly 5 elements");
  }

  const protocolAddresses = getProtocolAddresses();
  const calls: RouterCall[] = [];

  for (let i = 0; i < 5; i++) {
    const allocationBps = allocationsBps[i];
    if (allocationBps <= 0) continue; // Skip zero allocations

    // Check if protocol is allowed
    if (((allowBitmap >> i) & 1) === 0) {
      throw new Error(
        `Protocol ${i} is not allowed (bit not set in allowBitmap)`
      );
    }

    const target = protocolAddresses[i];
    if (!target || target === "0x0000000000000000000000000000000000000000") {
      console.warn(`Protocol ${i} has no registered target address, skipping`);
      continue;
    }

    // Build protocol-specific function calls
    let data: `0x${string}`;
    let value = 0n;

    if (i === PROTOCOL_IDS.MANTLE_REWARDS) {
      // Pendle Market: swapSyForExactPt(address receiver, uint256 exactPtOut, bytes calldata data)
      // Function signature: swapSyForExactPt(address,uint256,bytes)
      // Reference: https://mantlescan.xyz/token/0x7dc07C575A0c512422dCab82CE9Ed74dB58Be30C#code
      //
      // NOTE: This assumes the Safe already has SY tokens. In production, you may need to:
      // 1. First swap USDC -> SY using Pendle Router or another DEX
      // 2. Then call swapSyForExactPt to get PT tokens
      //
      // For now, we calculate exactPtOut based on allocation percentage.
      // If totalAmount is provided, calculate the PT amount; otherwise use a placeholder.
      const exactPtOut = totalAmount
        ? (totalAmount * BigInt(allocationBps)) / 10000n
        : BigInt(allocationBps) * 10n ** 15n; // Placeholder: allocationBps * 0.001 PT (18 decimals)

      data = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "swapSyForExactPt",
            inputs: [
              { name: "receiver", type: "address" },
              { name: "exactPtOut", type: "uint256" },
              { name: "data", type: "bytes" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "swapSyForExactPt",
        args: [
          safeAddress as Address, // receiver: PT tokens go to the Safe
          exactPtOut, // exactPtOut: exact amount of PT we want
          "0x" as `0x${string}`, // data: empty bytes for no callback
        ],
      });
    } else {
      // TODO: Replace with actual protocol-specific function calls for other protocols
      // Examples:
      // - Ondo: deposit(uint256 amount)
      // - Agni: swapExactInputSingle(...)
      // - Stargate: addLiquidity(...)
      // - INIT: deposit(...)

      // For now, create a no-op call (0x00 data) that will fail gracefully
      // In production, this should encode actual protocol function calls
      data = "0x00" as `0x${string}`;
    }

    calls.push({
      target,
      value,
      data,
    });
  }

  return calls;
}

export const buildRouterCallsMetadata = {
  name: "buildRouterCalls",
  description:
    "Build Router.Call[] array based on allocations. Each protocol with non-zero allocation gets a call. " +
    "Pendle (MANTLE_REWARDS) is implemented using swapSyForExactPt. Other protocols use placeholder calls " +
    "that should be extended with actual protocol function calls (deposit, swap, etc.).",
  schema: z.object({
    allocationsBps: z
      .array(z.number().int().min(0).max(10000))
      .length(5)
      .describe(
        "Allocation percentages in basis points (bps) for protocols [Ondo, Agni, Stargate, Mantle Rewards, INIT]"
      ),
    allowBitmap: z
      .number()
      .int()
      .min(0)
      .describe("Bitmap of allowed protocols (bit i = protocol i is allowed)"),
    safeAddress: z
      .string()
      .describe("Safe address (for context, not used in calls yet)"),
    totalAmount: z
      .string()
      .optional()
      .describe(
        "Optional: total USDC amount to allocate (as string, e.g. '1000000000' for 1000 USDC with 6 decimals)"
      ),
  }),
};
