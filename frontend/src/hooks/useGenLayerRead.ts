import { useState, useCallback } from 'react';
import { createReadClient } from '@/lib/genlayer/client';

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

      const client = createReadClient();

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
