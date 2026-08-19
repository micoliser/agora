import { useState, useCallback } from "react";
import { useGenLayerWrite } from "./useGenLayerWrite";
import { toast } from "sonner";
import { useApi } from "./useApi";

export type TxPhase =
  | "IDLE"
  | "CONFIRMING"
  | "SUBMITTED"
  | "SYNCING"
  | "CONFIRMED"
  | "FAILED"
  | "UNDETERMINED";

export interface ExecuteOptions {
  onConfirmed?: (receipt: unknown) => Promise<void> | void;
  confirmingMessage?: string;
  submittedMessage?: string;
  confirmedMessage?: string;
  syncRequests?: {
    entityType: string;
    entityId: number | string;
    currentState?: unknown;
  }[];
}

export function useTransaction() {
  const { submitTransaction } = useGenLayerWrite();
  const { fetchApi } = useApi();
  const [txPhase, setTxPhase] = useState<TxPhase>("IDLE");
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (
      contractAddress: string,
      functionName: string,
      args: unknown[],
      opts?: ExecuteOptions,
      value?: bigint,
    ) => {
      setTxPhase("CONFIRMING");
      setError(null);
      const toastId = toast.loading(
        opts?.confirmingMessage || "Please confirm in your wallet...",
      );

      let timeoutId: NodeJS.Timeout;
      try {
        const { receipt } = await submitTransaction(
          contractAddress,
          functionName,
          args,
          () => {
            setTxPhase("SUBMITTED");
            toast.loading(
              opts?.submittedMessage ||
                "Transaction submitted, waiting for confirmation...",
              { id: toastId },
            );

            timeoutId = setTimeout(() => {
              toast.loading(
                "Transaction is taking longer than expected. It is still being processing...",
                { id: toastId },
              );
            }, 60000);
          },
          value,
        );

        if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR") {
          throw new Error(
            "Transaction reverted during GenVM execution (FINISHED_WITH_ERROR)",
          );
        } else if (
          receipt.txExecutionResultName !== "FINISHED_WITH_RETURN" &&
          receipt.txExecutionResultName !== undefined
        ) {
          setTxPhase("UNDETERMINED");
          toast.warning(
            "The transaction was submitted but we couldn't confirm its outcome. Please wait a moment and refresh to check.",
            { id: toastId, duration: 10000 },
          );
          return;
        }

        if (opts?.syncRequests && opts.syncRequests.length > 0) {
          setTxPhase("SYNCING");
          toast.loading("Waiting for GenLayer network to index changes...", { id: toastId });
          
          // Small 1-second delay to give GenLayer a head start
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          let syncFailed = false;
          for (const req of opts.syncRequests) {
            try {
              const payload: Record<string, unknown> = {
                entity_type: req.entityType,
                entity_id: req.entityId,
              };
              if (req.currentState) payload.current_state = req.currentState;
              
              const res = await fetchApi("/api/indexer/sync-request/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              
              if (!res.ok) {
                syncFailed = true;
              }
            } catch (e) {
              console.warn("Failed to manually sync", req, e);
              syncFailed = true;
            }
          }

          if (syncFailed) {
            toast.warning(
              "Transaction confirmed, but the indexer might take a moment to catch up. Please refresh soon.",
              { id: toastId, duration: 10000 }
            );
          }
        }

        if (opts?.onConfirmed) {
          if (!(opts?.syncRequests && opts.syncRequests.length > 0)) {
            setTxPhase("SYNCING");
            toast.loading("Syncing updated state...", { id: toastId });
          }
          await opts.onConfirmed(receipt);
        }

        setTxPhase("CONFIRMED");
        toast.success(opts?.confirmedMessage || "Transaction confirmed!", {
          id: toastId,
        });

        if (timeoutId!) clearTimeout(timeoutId);
      } catch (err: unknown) {
        if (timeoutId!) clearTimeout(timeoutId);
        console.error("Tx Error:", err);
        const errMsg = (err as Error).message || String(err);

        if (
          errMsg.toLowerCase().includes("user rejected") ||
          errMsg.toLowerCase().includes("denied")
        ) {
          setTxPhase("FAILED");
          setError("Transaction was rejected by the user.");
          toast.error("Transaction was rejected by the user.", { id: toastId });
          return;
        }

        if (
          errMsg.toLowerCase().includes("timeout") ||
          errMsg.toLowerCase().includes("timed out")
        ) {
          // Transaction was submitted but polling timed out (likely rate limited).
          // The tx probably succeeded on-chain, so still attempt sync + onConfirmed.
          toast.loading("Syncing state (confirmation timed out, but tx was likely successful)...", { id: toastId });
          
          if (opts?.syncRequests && opts.syncRequests.length > 0) {
            // Wait longer since GenLayer was clearly overloaded
            await new Promise(resolve => setTimeout(resolve, 5000));
            for (const req of opts.syncRequests) {
              try {
                await fetchApi("/api/indexer/sync-request/", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    entity_type: req.entityType,
                    entity_id: req.entityId,
                  }),
                });
              } catch (syncErr) {
                console.warn("Timeout recovery sync failed", req, syncErr);
              }
            }
          }

          if (opts?.onConfirmed) {
            try {
              await opts.onConfirmed(null);
            } catch (confirmErr) {
              console.warn("Timeout recovery onConfirmed failed", confirmErr);
            }
          }

          setTxPhase("CONFIRMED");
          toast.success(opts?.confirmedMessage || "Transaction likely confirmed!", {
            id: toastId,
          });
          return;
        }

        setTxPhase("FAILED");
        setError(errMsg);
        toast.error(errMsg, { id: toastId });
      }
    },
    [submitTransaction, fetchApi],
  );

  const isLocked = txPhase === "CONFIRMING" || txPhase === "SUBMITTED" || txPhase === "SYNCING";

  const reset = useCallback(() => {
    setTxPhase("IDLE");
    setError(null);
  }, []);

  return {
    execute,
    txPhase,
    isLocked,
    error,
    reset,
  };
}
