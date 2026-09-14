"use client";

import { useCallback, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { createWriteClient } from "@/lib/genlayer/client";
import { STUDIONET_CHAIN_ID } from "@/lib/genlayer/chain";

/** genlayer-js TransactionStatus numeric codes (do not treat 3/4 as terminal). */
const STATUS_BY_CODE: Record<string, string> = {
  "0": "UNINITIALIZED",
  "1": "PENDING",
  "2": "PROPOSING",
  "3": "COMMITTING",
  "4": "REVEALING",
  "5": "ACCEPTED",
  "6": "UNDETERMINED",
  "7": "FINALIZED",
  "8": "CANCELED",
  "9": "APPEAL_REVEALING",
  "10": "APPEAL_COMMITTING",
  "11": "READY_TO_FINALIZE",
  "12": "VALIDATORS_TIMEOUT",
  "13": "LEADER_TIMEOUT",
};

const EXEC_BY_CODE: Record<string, string> = {
  "0": "NOT_VOTED",
  "1": "FINISHED_WITH_RETURN",
  "2": "FINISHED_WITH_ERROR",
};

const SUCCESS_STATUS = new Set(["ACCEPTED", "FINALIZED"]);
const FAILED_STATUS = new Set([
  "UNDETERMINED",
  "CANCELED",
  "VALIDATORS_TIMEOUT",
  "LEADER_TIMEOUT",
  "REVERTED",
  "ERROR",
]);

const POLL_MS = 3000;
const MAX_POLLS = 40;

type Receipt = Record<string, unknown> & {
  txExecutionResultName?: string;
  hash?: string;
};

function normalizeStatus(tx: Record<string, unknown>): string {
  const named = tx.statusName ?? tx.status_name;
  if (typeof named === "string" && named.trim()) {
    const upper = named.trim().toUpperCase().replace(/\s+/g, "_");
    return STATUS_BY_CODE[upper] ?? upper;
  }
  const raw = String(tx.status ?? tx.txStatus ?? "").toUpperCase();
  return STATUS_BY_CODE[raw] ?? raw;
}

function normalizeExec(tx: Record<string, unknown>): string {
  const named = tx.txExecutionResultName;
  if (typeof named === "string" && named.trim()) {
    return named.trim().toUpperCase().replace(/\s+/g, "_");
  }
  const raw = String(tx.txExecutionResult ?? "");
  return EXEC_BY_CODE[raw] ?? raw.toUpperCase();
}

async function waitForReceipt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  txHash: string,
): Promise<Receipt> {
  let lastError: unknown;
  let consecutiveFetchFailures = 0;

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    try {
      const tx = (await client.getTransaction({ hash: txHash })) as Record<
        string,
        unknown
      > | null;
      consecutiveFetchFailures = 0;
      if (tx) {
        const status = normalizeStatus(tx);
        const exec = normalizeExec(tx);

        if (FAILED_STATUS.has(status) || exec === "FINISHED_WITH_ERROR") {
          tx.txExecutionResultName = "FINISHED_WITH_ERROR";
          return tx as Receipt;
        }

        if (SUCCESS_STATUS.has(status)) {
          tx.txExecutionResultName =
            exec === "FINISHED_WITH_ERROR"
              ? "FINISHED_WITH_ERROR"
              : "FINISHED_WITH_RETURN";
          return tx as Receipt;
        }
      }
    } catch (err) {
      lastError = err;
      consecutiveFetchFailures += 1;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes("429") || msg.includes("rate limit")) {
        await sleep(POLL_MS * 2);
        continue;
      }
      if (
        consecutiveFetchFailures >= 5 &&
        (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch"))
      ) {
        throw new Error(
          "Could not confirm the transaction from this browser. Refresh the page to see the latest status.",
        );
      }
    }
    await sleep(POLL_MS);
  }
  const extra = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for transaction confirmation.${extra}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanizeTxError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("wallet_getsnaps") || lower.includes("corresponding handler")) {
    return "MetaMask Snap RPC is not required on Studionet. Retry the transaction.";
  }
  if (lower.includes("user rejected") || lower.includes("denied")) {
    return "Transaction was rejected by the user.";
  }
  return message || "An unknown error occurred during the transaction.";
}

export function useGenLayerWrite() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTransaction = useCallback(
    async (
      contractAddress: string,
      functionName: string,
      args: unknown[],
      onTxHash?: (hash: string) => void,
      value?: bigint,
    ) => {
      if (!isConnected || !address || !connector) {
        throw new Error("Wallet not connected");
      }
      if (!contractAddress?.trim()) {
        throw new Error("Contract address is not configured.");
      }

      try {
        setIsPending(true);
        setError(null);

        if (chainId !== STUDIONET_CHAIN_ID) {
          if (!switchChainAsync) {
            throw new Error("Cannot switch chain. Please switch network in your wallet manually.");
          }
          await switchChainAsync({ chainId: STUDIONET_CHAIN_ID });
        }

        const provider = await connector.getProvider();
        if (!provider) {
          throw new Error("Wallet provider not found.");
        }

        const client = createWriteClient(address as `0x${string}`, provider);
        try {
          await client.connect("studionet");
        } catch (err) {
          console.warn(
            "genlayer-js connect() failed (snap/chain); continuing with injected provider:",
            err,
          );
        }

        const txHash = (await client.writeContract({
          address: contractAddress as `0x${string}`,
          functionName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          args: args as any,
          value: value ?? BigInt(0),
        })) as string;

        if (onTxHash) {
          onTxHash(txHash);
        }

        const receipt = await waitForReceipt(client, txHash);

        if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR") {
          throw new Error(
            "Transaction reverted during GenVM execution (FINISHED_WITH_ERROR)",
          );
        }

        return { txHash, receipt };
      } catch (err: unknown) {
        const message = humanizeTxError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setIsPending(false);
      }
    },
    [isConnected, address],
  );

  return { submitTransaction, isPending, error };
}
