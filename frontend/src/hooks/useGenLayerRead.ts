import { useState, useCallback } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export function useGenLayerRead() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readContract = useCallback(async (
    contractAddress: string,
    functionName: string,
    args: unknown[]
  ) => {
    try {
      setIsPending(true);
      setError(null);
      
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
      });

      const result = await client.readContract({
        address: contractAddress as `0x${string}`,
        functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
      });

      return result;
    } catch (err: unknown) {
      console.error("GenLayer read error:", err);
      if (err instanceof Error) {
        setError(err.message || "An unknown error occurred during read.");
      }
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { readContract, isPending, error };
}
