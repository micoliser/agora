import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export function useGenLayerWrite() {
  const { address, isConnected } = useAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTransaction = useCallback(async (
    contractAddress: string,
    functionName: string,
    args: unknown[],
    onTxHash?: (hash: string) => void,
    value?: bigint
  ) => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    try {
      setIsPending(true);
      setError(null);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let provider: any = null;
      if (typeof window !== 'undefined' && // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).ethereum) {
        provider = // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).ethereum;
        if (!provider.isMetaMask) {
          throw new Error("Only MetaMask is supported. Please switch to MetaMask.");
        }
      }

      if (!provider) {
        throw new Error("No wallet provider found. Please install MetaMask.");
      }

      const safeStudionet = studionet || {
        id: 61999,
        isStudio: true,
        name: "Genlayer Studio Network",
        rpcUrls: {
          default: {
            http: ["https://studio.genlayer.com/api"]
          }
        },
        nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 }
      };

      const client = createClient({
        chain: safeStudionet,
        account: address as `0x${string}`,
        provider,
      });

      await client.connect("studionet");

      const txHash = await client.writeContract({
        address: contractAddress as `0x${string}`,
        functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
        value: value ?? BigInt(0),
      });

      if (onTxHash) {
        onTxHash(txHash);
      }

      // Custom resilient polling loop for receipt to survive 429s
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receipt: any = null;
      let retries = 60;
      while (retries > 0) {
        try {
          // We manually call getTransaction to catch errors
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tx = await client.getTransaction({ hash: txHash as any });
          const s1 = String(tx?.status).toUpperCase();
          const s2 = String((tx as Record<string, unknown>)?.statusName).toUpperCase();
          
          if (["ACCEPTED", "FINALIZED", "3", "5", "7"].includes(s1) || ["ACCEPTED", "FINALIZED", "3", "5", "7"].includes(s2)) {
            receipt = tx;
            if (client.chain.isStudio) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            receipt.txExecutionResultName = (tx as any).txExecutionResultName || "FINISHED_WITH_RETURN"; 
            }
            break;
          }
          if (["REVERTED", "CANCELED", "UNDETERMINED", "ERROR", "4", "8", "9"].includes(s1) || ["REVERTED", "CANCELED", "UNDETERMINED", "ERROR", "4", "8", "9"].includes(s2)) {
            receipt = tx;
            receipt.txExecutionResultName = "FINISHED_WITH_ERROR";
            break;
          }
        } catch (e: unknown) {
          console.error("[POLLING DEBUG] error fetching tx:", e);
          const errMsg = (e as Error).message ? (e as Error).message.toLowerCase() : String(e).toLowerCase();
          if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("fetch")) {
             console.warn("Hit GenLayer rate limit, waiting 5 seconds and retrying...");
             // Just swallow the 429 and sleep longer
          } else if (errMsg.includes("not found")) {
             // tx not indexed yet
          } else {
             console.warn("Unknown error during polling:", e);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 8000)); // Poll every 8s to be safe
        retries--;
      }

      if (!receipt) {
        throw new Error("Timed out waiting for transaction confirmation.");
      }

      if (receipt.txExecutionResultName === 'FINISHED_WITH_ERROR') {
        throw new Error("Transaction reverted during GenVM execution (FINISHED_WITH_ERROR)");
      }

      return { txHash, receipt };
    } catch (err: unknown) {
      console.error("GenLayer write error:", err);
      if (err instanceof Error && err.message.toLowerCase().includes('user rejected')) {
        setError("Transaction was rejected by the user.");
      } else if (err instanceof Error) {
        setError(err.message || "An unknown error occurred during the transaction.");
      } else {
        setError("An unknown error occurred during the transaction.");
      }
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [isConnected, address]);

  return { submitTransaction, isPending, error };
}
