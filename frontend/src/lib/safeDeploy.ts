import { createPublicClient, http, type Address } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import type { WalletClient } from "viem";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { targetChain } from "@/lib/wagmi";

function parseEnvAddress(v: string | undefined, varName: string): Address | null {
  if (!v) return null;
  if (v.startsWith("0x") && v.length === 42) return v as Address;
  throw new Error(`${varName} must be a 0x-prefixed 20-byte address.`);
}

function validatePimlicoUrl(url: string, varName: string) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("api.pimlico.io")) return;

    // Common Pimlico shape: /v2/<chain>/rpc?apikey=...
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[0] === "v2" && parts[2] === "rpc") {
      const chainSeg = parts[1] ?? "";
      // If user pasted a numeric chain id (e.g. /v2/137/rpc) validate it matches the target chain.
      if (/^\d+$/.test(chainSeg)) {
        const n = Number(chainSeg);
        if (Number.isFinite(n) && n === targetChain.id) return;
        throw new Error(
          `${varName} looks like a Pimlico URL but uses a numeric chain segment (/v2/${chainSeg}/rpc). ` +
            `Your app is currently targeting chainId ${targetChain.id} (${targetChain.name}). ` +
            `Use the Pimlico endpoint for the same chain (or switch the app network toggle).`
        );
      }
    }
  } catch (e) {
    // Re-throw as a clean message for the UI.
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg);
  }
}

function requireBundlerUrl(): string {
  // IMPORTANT: This file is used by client components.
  // Next.js only inlines env vars when accessed statically (process.env.NEXT_PUBLIC_*).
  // Dynamic access (process.env[name]) will be undefined in the browser.
  const v = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL;
  if (!v) {
    throw new Error(
      "NEXT_PUBLIC_BUNDLER_RPC_URL is not set. Add it to frontend/.env (see env.example) and restart `npm run dev`."
    );
  }
  validatePimlicoUrl(v, "NEXT_PUBLIC_BUNDLER_RPC_URL");
  return v;
}

function requirePaymasterUrl(): string {
  const v = process.env.NEXT_PUBLIC_PAYMASTER_RPC_URL;
  if (!v) {
    throw new Error(
      "NEXT_PUBLIC_PAYMASTER_RPC_URL is not set. Paymaster sponsorship is enabled, so this is required."
    );
  }
  validatePimlicoUrl(v, "NEXT_PUBLIC_PAYMASTER_RPC_URL");
  return v;
}

export async function getSafeAccount({
  walletClient,
  saltNonce = BigInt(0),
}: {
  walletClient: WalletClient;
  saltNonce?: bigint;
}) {
  const publicClient = createPublicClient({
    chain: targetChain,
    transport: http(targetChain.rpcUrls.default.http[0]),
  });

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    owners: [walletClient],
    version: "1.4.1",
    saltNonce,
    // Enable ProofGateSafeModule during Safe setup if configured.
    ...(parseEnvAddress(
      process.env.NEXT_PUBLIC_PROOF_GATE_SAFE_MODULE_ADDRESS,
      "NEXT_PUBLIC_PROOF_GATE_SAFE_MODULE_ADDRESS"
    )
      ? {
          safeModules: [
            parseEnvAddress(
              process.env.NEXT_PUBLIC_PROOF_GATE_SAFE_MODULE_ADDRESS,
              "NEXT_PUBLIC_PROOF_GATE_SAFE_MODULE_ADDRESS"
            )!,
          ],
        }
      : {}),
  });

  const safeAddress = await safeAccount.getAddress();
  return { publicClient, safeAccount, safeAddress };
}

export async function getSafeSmartAccountClient({
  walletClient,
  saltNonce = BigInt(0),
}: {
  walletClient: WalletClient;
  saltNonce?: bigint;
}) {
  const bundlerUrl = requireBundlerUrl();
  const paymasterUrl = requirePaymasterUrl();

  const { publicClient, safeAccount, safeAddress } = await getSafeAccount({
    walletClient,
    saltNonce,
  });

  const paymasterClient = createPimlicoClient({
    chain: targetChain,
    transport: http(paymasterUrl),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: targetChain,
    bundlerTransport: http(bundlerUrl),
    paymaster: {
      // Prefer sponsorship; fallback to standard paymaster methods if sponsor isn't enabled.
      getPaymasterData: async (params) => {
        try {
          const {
            context,
            chainId: _c,
            entryPointAddress: _e,
            ...userOperation
          } = params as unknown as { [k: string]: unknown };
          void _c;
          void _e;
          type SponsorArgs = Parameters<
            typeof paymasterClient.sponsorUserOperation
          >[0];
          return await paymasterClient.sponsorUserOperation({
            userOperation:
              userOperation as unknown as SponsorArgs["userOperation"],
            paymasterContext: context,
          } satisfies SponsorArgs);
        } catch (err) {
          void err;
          return await paymasterClient.getPaymasterData(
            params as unknown as Parameters<typeof paymasterClient.getPaymasterData>[0]
          );
        }
      },
      getPaymasterStubData: async (params) => {
        try {
          const {
            context,
            chainId: _c,
            entryPointAddress: _e,
            ...userOperation
          } = params as unknown as { [k: string]: unknown };
          void _c;
          void _e;
          type SponsorArgs = Parameters<
            typeof paymasterClient.sponsorUserOperation
          >[0];
          return await paymasterClient.sponsorUserOperation({
            userOperation:
              userOperation as unknown as SponsorArgs["userOperation"],
            paymasterContext: context,
          } satisfies SponsorArgs);
        } catch (err) {
          void err;
          return await paymasterClient.getPaymasterStubData(
            params as unknown as Parameters<typeof paymasterClient.getPaymasterStubData>[0]
          );
        }
      },
    },
    userOperation: {
      estimateFeesPerGas: async () => {
        try {
          const gasPrice = await paymasterClient.getUserOperationGasPrice();
          return gasPrice.fast;
        } catch (err) {
          void err;
          const fees = await publicClient.estimateFeesPerGas();
          return {
            maxFeePerGas: fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0),
            maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? BigInt(0),
          };
        }
      },
    },
  });

  return { publicClient, safeAddress, smartAccountClient };
}

/**
 * Deploy a Safe smart account (proxy) via ERC-4337 (Option B).
 *
 * Notes:
 * - This uses a Bundler RPC (and optionally a Paymaster later) to submit a UserOperation.
 * - The Safe may be counterfactual initially; it becomes deployed on the first UserOp.
 * - For now, we deploy the Safe only. We DO NOT enable ProofGateSafeModule yet.
 *   TODO(arbiter): once ProofGateSafeModule is deployed on Mantle, pass its address in `safeModules`
 *   so it gets enabled during Safe setup, or send a follow-up Safe tx to enable it.
 */
export async function deploySafe4337({
  walletClient,
  saltNonce = BigInt(0),
}: {
  walletClient: WalletClient;
  saltNonce?: bigint;
}): Promise<{ safeAddress: Address; userOpHash: `0x${string}` }> {
  const ownerAddress = walletClient.account?.address as Address | undefined;
  if (!ownerAddress) {
    throw new Error("No connected wallet account found.");
  }

  const { safeAddress, smartAccountClient } = await getSafeSmartAccountClient({
    walletClient,
    saltNonce,
  });

  // Trigger Safe deployment by sending a harmless call. This will deploy the Safe (if needed)
  // and then execute the call via the Safe4337Module.
  const userOpHash = await smartAccountClient.sendUserOperation({
    calls: [{ to: ownerAddress, value: BigInt(0), data: "0x" }],
  });

  await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });

  return { safeAddress, userOpHash };
}
