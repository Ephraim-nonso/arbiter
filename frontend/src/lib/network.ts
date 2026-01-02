import { mantle, mantleSepoliaTestnet } from "wagmi/chains";

/**
 * Toggle which Mantle network the app targets.
 *
 * - true  => Mantle Sepolia testnet (chainId 5003)
 * - false => Mantle mainnet (chainId 5000)
 *
 * This is compile-time in the browser (NEXT_PUBLIC_*), so restart `npm run dev`
 * after changing env vars.
 */
export const USE_MANTLE_SEPOLIA =
  process.env.NEXT_PUBLIC_USE_MANTLE_SEPOLIA === "true";

export function getTargetChain() {
  return USE_MANTLE_SEPOLIA ? mantleSepoliaTestnet : mantle;
}
