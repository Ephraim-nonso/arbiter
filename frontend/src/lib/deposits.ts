import { erc20Abi, parseAbiItem, type Address, type PublicClient } from "viem";
import { getUsdcAddressForChain } from "@/lib/usdc";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

async function getLogsPaged(params: {
  publicClient: PublicClient;
  address: Address;
  args: { to?: Address; from?: Address };
  fromBlock: bigint;
  toBlock: bigint;
  // Many RPC providers reject large `eth_getLogs` block ranges (Mantle Sepolia: 10,000).
  // We stay below that limit.
  maxRangeBlocks?: bigint;
}) {
  const {
    publicClient,
    address,
    args,
    fromBlock,
    toBlock,
    maxRangeBlocks = 9_500n,
  } = params;

  if (toBlock < fromBlock) return [];

  // Keep typing simple here: Turbopack's TS parser can choke on advanced indexed-access generics.
  const out: Array<{ args?: { value?: bigint }; blockNumber?: bigint }> = [];

  let start = fromBlock;
  while (start <= toBlock) {
    const end =
      start + maxRangeBlocks > toBlock ? toBlock : start + maxRangeBlocks;
    const chunk = await publicClient.getLogs({
      address,
      event: transferEvent,
      args,
      fromBlock: start,
      toBlock: end,
    });
    out.push(...(chunk as unknown as typeof out));
    start = end + 1n;
  }

  return out;
}

function envInt(name: string): number | null {
  // NOTE: This file is used by client components; only NEXT_PUBLIC_* is available.
  const raw = (process.env as Record<string, string | undefined>)[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function fetchUsdcDepositStats({
  publicClient,
  chainId,
  safeAddress,
}: {
  publicClient: PublicClient;
  chainId: number;
  safeAddress: Address;
}): Promise<{
  totalIn: bigint;
  totalOut: bigint;
  net: bigint;
  lastInTsMs: number | null;
}> {
  const usdc = getUsdcAddressForChain(chainId);
  const latestBlock = await publicClient.getBlockNumber();

  // Mantle Sepolia is tiny; scanning from genesis is acceptable for MVP accuracy.
  // Mantle mainnet can be large; default to a lookback window unless overridden.
  const lookback =
    chainId === 5003
      ? Number.MAX_SAFE_INTEGER
      : envInt("NEXT_PUBLIC_DEPOSIT_LOOKBACK_BLOCKS") ?? 300_000;
  const fromBlock =
    lookback === Number.MAX_SAFE_INTEGER
      ? 0n
      : latestBlock > BigInt(lookback)
        ? latestBlock - BigInt(lookback)
        : 0n;

  // Many RPCs reject wide getLogs ranges. Page requests to stay under limits.
  const [ins, outs] = await Promise.all([
    getLogsPaged({
      publicClient,
      address: usdc,
      args: { to: safeAddress },
      fromBlock,
      toBlock: latestBlock,
    }),
    getLogsPaged({
      publicClient,
      address: usdc,
      args: { from: safeAddress },
      fromBlock,
      toBlock: latestBlock,
    }),
  ]);

  let totalIn = 0n;
  for (const l of ins) totalIn += (l.args?.value ?? 0n) as bigint;

  let totalOut = 0n;
  for (const l of outs) totalOut += (l.args?.value ?? 0n) as bigint;

  const net = totalIn >= totalOut ? totalIn - totalOut : 0n;

  // getLogs is returned in ascending block order for a single range; across pages it stays ascending
  // because we scan from low->high.
  const lastIn = ins.length ? ins[ins.length - 1] : null;
  const lastInTsMs =
    lastIn?.blockNumber != null
      ? Number((await publicClient.getBlock({ blockNumber: lastIn.blockNumber })).timestamp) *
        1000
      : null;

  return { totalIn, totalOut, net, lastInTsMs };
}

export async function fetchUsdcBalance({
  publicClient,
  chainId,
  safeAddress,
}: {
  publicClient: PublicClient;
  chainId: number;
  safeAddress: Address;
}): Promise<bigint> {
  const usdc = getUsdcAddressForChain(chainId);
  return await publicClient.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [safeAddress],
  });
}


