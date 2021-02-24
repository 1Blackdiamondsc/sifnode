import { PegTxEventEmitter } from "../../../api/EthbridgeService/PegTxEventEmitter";
import notify from "../../../api/utils/Notifications";
import { TransactionStatus } from "../../../entities";
import { WithStore } from "../../../store";

/**
 * Track changes to a tx emitter send notifications
 * and update a key in the store
 * @param tx with hash set
 */
export const createSubscribeToTx = ({ store }: WithStore<"tx">) => {
  // Helper to set store tx status
  function storeSetTxStatus(
    hash: string | undefined,
    state: TransactionStatus
  ) {
    if (!hash) return;
    store.tx.eth[hash] = state;
  }

  return function subscribeToTx(tx: PegTxEventEmitter) {
    function unsubscribe() {
      tx.removeListeners();
    }

    function handleHash(txHash: string) {
      storeSetTxStatus(txHash, {
        hash: txHash,
        memo: "Transaction Accepted",
        state: "accepted",
      });

      notify({
        type: "info",
        message: "Pegged Transaction Pending",
        detail: {
          type: "etherscan",
          message: txHash,
        },
        loader: true,
      });
    }

    if (tx.hash) {
      handleHash(tx.hash);
    }

    tx.onTxHash(({ txHash }) => {
      handleHash(txHash);
    });

    tx.onComplete(({ txHash }) => {
      storeSetTxStatus(txHash, {
        hash: txHash,
        memo: "Transaction Complete",
        state: "completed",
      });

      notify({
        type: "success",
        message: `Transfer ${txHash} has succeded.`,
      });

      // tx is complete so we can unsubscribe
      unsubscribe();
    });

    tx.onError(err => {
      storeSetTxStatus(tx.hash, {
        hash: tx.hash!, // wont matter if tx.hash doesnt exist
        memo: "Transaction Failed",
        state: "failed",
      });
      notify({ type: "error", message: err.payload.memo! });
    });

    return unsubscribe;
  };
};
