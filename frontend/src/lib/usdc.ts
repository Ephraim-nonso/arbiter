import type { Address } from "viem";
import { parseUnits } from "viem";

function isAddressLike(a: string): a is Address {
  return a.startsWith("0x") && a.length === 42;
}

/**
 * USDC is not the same address across networks. We require it via env vars.
 *
 * - Mantle mainnet: NEXT_PUBLIC_USDC_ADDRESS_MANTLE
 * - Mantle Sepolia: NEXT_PUBLIC_USDC_ADDRESS_MANTLE_SEPOLIA
 */
export function getUsdcAddressForChain(chainId: number): Address {
  const mainnet = process.env.NEXT_PUBLIC_USDC_ADDRESS_MANTLE;
  const sepolia = process.env.NEXT_PUBLIC_USDC_ADDRESS_MANTLE_SEPOLIA;

  const v = chainId === 5000 ? mainnet : chainId === 5003 ? sepolia : undefined;
  if (!v || !isAddressLike(v)) {
    throw new Error(
      `USDC address not configured for chainId ${chainId}. Set NEXT_PUBLIC_USDC_ADDRESS_MANTLE / NEXT_PUBLIC_USDC_ADDRESS_MANTLE_SEPOLIA in frontend env.`
    );
  }
  return v;
}

export function parseUsdcToMicros(amount: string): bigint {
  const trimmed = amount.trim();
  if (!trimmed) throw new Error("Enter a USDC amount.");
  // USDC uses 6 decimals.
  const micros = parseUnits(trimmed, 6);
  if (micros <= 0n) throw new Error("Amount must be > 0.");
  return micros;
}

export function formatUsdcFromMicros(micros: bigint): number {
  // For UI display only; the UI already rounds with toFixed(2).
  return Number(micros) / 1_000_000;
}


