import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { STUDIONET_CHAIN_ID, STUDIONET_RPC } from "@/lib/genlayer/chain";

const fallbackChain = {
  id: STUDIONET_CHAIN_ID,
  isStudio: true,
  name: "Genlayer Studio Network",
  rpcUrls: {
    default: {
      http: [STUDIONET_RPC],
    },
  },
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
};

export function studioChain() {
  return studionet || fallbackChain;
}

export function requireMetaMaskProvider() {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }
  const provider = (window as any).genlayer?.provider || window.ethereum;
  if (!provider) {
    throw new Error("No wallet found. Please install a Web3 wallet like MetaMask.");
  }
  return provider;
}

export function createWriteClient(account: `0x${string}`) {
  const provider = requireMetaMaskProvider();
  return createClient({
    chain: studioChain(),
    account,
    provider,
  });
}

export function createReadClient() {
  return createClient({
    chain: studioChain(),
  });
}
