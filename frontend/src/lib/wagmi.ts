import { http, createConfig } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { mantle } from "./chains";

const appName = "Arbiter";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName }),
  // IMPORTANT: WalletConnect uses browser storage (IndexedDB). Only instantiate it in the browser,
  // otherwise Next build/SSR can crash with "indexedDB is not defined".
  ...(typeof window !== "undefined" && wcProjectId
    ? [walletConnect({ projectId: wcProjectId, showQrModal: true })]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [mantle],
  connectors,
  transports: {
    [mantle.id]: http(),
  },
});

export const isWalletConnectEnabled = Boolean(wcProjectId);


