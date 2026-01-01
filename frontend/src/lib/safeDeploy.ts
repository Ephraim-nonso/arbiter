import { createPublicClient, http, type Address } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import type { WalletClient } from "viem";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { mantle } from "@/lib/chains";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Add it to your .env (see env.example) to deploy a Safe via ERC-4337.`
    );
  }
  return v;
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
  const bundlerUrl = requireEnv("NEXT_PUBLIC_BUNDLER_RPC_URL");

  const publicClient = createPublicClient({
    chain: mantle,
    transport: http(mantle.rpcUrls.default.http[0]),
  });

  const ownerAddress = walletClient.account?.address as Address | undefined;
  if (!ownerAddress) {
    throw new Error("No connected wallet account found.");
  }

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    owners: [walletClient],
    version: "1.4.1",
    saltNonce,
    // safeModules: [<ProofGateSafeModule address>],
  });

  const safeAddress = await safeAccount.getAddress();

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: mantle,
    bundlerTransport: http(bundlerUrl),
  });

  // Trigger Safe deployment by sending a harmless call. This will deploy the Safe (if needed)
  // and then execute the call via the Safe4337Module.
  const userOpHash = await smartAccountClient.sendUserOperation({
    calls: [{ to: ownerAddress, value: BigInt(0), data: "0x" }],
  });

  await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });

  return { safeAddress, userOpHash };
}


