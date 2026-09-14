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

export function createWriteClient(account: `0x${string}`, provider: any) {
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
