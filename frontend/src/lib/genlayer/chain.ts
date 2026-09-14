import { defineChain } from "viem";
import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { studionet as genlayerStudionet } from "genlayer-js/chains";

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_RPC =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER = "https://explorer-studio.genlayer.com";

const genlayerId =
  genlayerStudionet && typeof genlayerStudionet.id === "number"
    ? genlayerStudionet.id
    : STUDIONET_CHAIN_ID;

export const studionetChain = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || genlayerId || STUDIONET_CHAIN_ID),
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: [STUDIONET_RPC] },
  },
  blockExplorers: {
    default: { name: "Studio Explorer", url: STUDIONET_EXPLORER },
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: 'Agora',
  projectId: 'YOUR_PROJECT_ID', // Replace with your WalletConnect Project ID
  chains: [studionetChain],
  transports: {
    [studionetChain.id]: http(STUDIONET_RPC),
  },
  ssr: true,
});

function chainIdHex(id: number): `0x${string}` {
  return `0x${id.toString(16)}`;
}

export const studionetWalletParams = {
  chainId: chainIdHex(studionetChain.id),
  chainName: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: [STUDIONET_RPC],
  blockExplorerUrls: [STUDIONET_EXPLORER],
};

async function readProviderChainId(
  eth: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
): Promise<string> {
  const raw = await eth.request({ method: "eth_chainId" });
  return String(raw ?? "").toLowerCase();
}

export async function ensureStudionetChain(): Promise<void> {
  const eth = typeof window !== "undefined" ? ((window as any).genlayer?.provider || window.ethereum) : undefined;
  if (!eth?.request) {
    throw new Error("No Ethereum provider found. Install MetaMask.");
  }

  const expected = studionetWalletParams.chainId.toLowerCase();

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: studionetWalletParams.chainId }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 4902 || code === -32603) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [studionetWalletParams],
      });
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: studionetWalletParams.chainId }],
      });
    } else {
      throw err instanceof Error
        ? err
        : new Error("Could not switch MetaMask to Studionet.");
    }
  }

  const current = await readProviderChainId(eth);
  if (current !== expected) {
    throw new Error(
      `Wrong network: expected Studionet (${expected}), got ${current || "unknown"}. Switch MetaMask and try again.`,
    );
  }
}
