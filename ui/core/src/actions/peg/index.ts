import { ActionContext } from "..";
import { Address, Asset, AssetAmount, TransactionStatus } from "../../entities";
import notify from "../../api/utils/Notifications";
import JSBI from "jsbi";
import wallet from "../wallet";
import { effect } from "@vue/reactivity";
import { PegTxEventEmitter } from "../../api/EthbridgeService/PegTxEventEmitter";

function isOriginallySifchainNativeToken(asset: Asset) {
  return ["erowan", "rowan"].includes(asset.symbol);
}

// listen for 50 confirmations
// Eventually this should be set on ebrelayer
// to centralize the business logic
const ETH_CONFIRMATIONS = 50;

// TODO: Store should probably be wrapped in a ViewModel or StoreService and this should be a method on it
//       Eg. services.store.onAddressChange, services.store.setTxStatus

// TODO: Subscriptions, Commands and Queries should all be their own concepts and each exist within their
//       own files to manage complexity and avoid refactoring

export default ({
  api,
  store,
}: ActionContext<
  "SifService" | "EthbridgeService" | "EthereumService",
  "wallet" | "tx"
>) => {
  // Update a tx state in the store
  function storeSetTxStatus(
    hash: string | undefined,
    state: TransactionStatus
  ) {
    if (!hash) return;
    store.tx.eth[hash] = state;
  }

  /**
   * Track changes to a tx emitter send notifications
   * and update a key in the store
   * @param tx with hash set
   */
  function subscribeToTx(tx: PegTxEventEmitter) {
    function unsubscribe() {
      tx.removeListeners();
    }

    tx.onTxHash(({ txHash }) => {
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
    })
      .onComplete(({ txHash }) => {
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
      })
      .onError(err => {
        storeSetTxStatus(tx.hash, {
          hash: tx.hash!, // wont matter if tx.hash doesnt exist
          memo: "Transaction Failed",
          state: "failed",
        });
        notify({ type: "error", message: err.payload.memo! });
      });

    return unsubscribe;
  }

  // This is an example of a subscription and this should be moved to its own file to encapsulate complexity
  function subscribeToUnconfirmedPegTxs(address: string) {
    async function getSubscriptions() {
      const pendingTxs: PegTxEventEmitter[] = await api.EthbridgeService.fetchUnconfirmedLockBurnTxs(
        address,
        ETH_CONFIRMATIONS
      );
      return pendingTxs.map(subscribeToTx);
    }

    // Need to keep subscriptions syncronous so using promise
    const subscriptionsPromise = getSubscriptions();

    // Return unsubscribe synchronously
    return () => {
      subscriptionsPromise.then(subscriptions =>
        subscriptions.forEach(unsubscribe => unsubscribe())
      );
    };
  }

  // TODO: Move to a vue hook
  // This is an example of a subscription invocation currently this is but this could later be moved to vue code
  // React to address changes on the store and reset subscriptions when changed
  let unsub: (() => void) | null;
  let lastAddress: string;
  effect(() => {
    // Sometimes effect will run when value has not changed and
    // we cannot use watch because of dependency polution (no vue in core)
    if (lastAddress !== store.wallet.eth.address) {
      // Unsubscribe if required
      unsub && unsub();

      if (store.wallet.eth.address) {
        unsub = subscribeToUnconfirmedPegTxs(store.wallet.eth.address);
      }
    }
    lastAddress = store.wallet.eth.address;
  });

  const actions = {
    getSifTokens() {
      return api.SifService.getSupportedTokens();
    },

    getEthTokens() {
      return api.EthereumService.getSupportedTokens();
    },

    calculateUnpegFee(asset: Asset) {
      const feeNumber = isOriginallySifchainNativeToken(asset)
        ? "18332015000000000"
        : "16164980000000000";

      return AssetAmount(Asset.get("ceth"), JSBI.BigInt(feeNumber), {
        inBaseUnit: true,
      });
    },

    async unpeg(assetAmount: AssetAmount) {
      const lockOrBurnFn = isOriginallySifchainNativeToken(assetAmount.asset)
        ? api.EthbridgeService.lockToEthereum
        : api.EthbridgeService.burnToEthereum;

      const feeAmount = this.calculateUnpegFee(assetAmount.asset);

      const tx = await lockOrBurnFn({
        assetAmount,
        ethereumRecipient: store.wallet.eth.address,
        fromAddress: store.wallet.sif.address,
        feeAmount,
      });

      console.log(
        "unpeg",
        tx,
        assetAmount,
        store.wallet.eth.address,
        store.wallet.sif.address,
        feeAmount
      );

      const txStatus = await api.SifService.signAndBroadcast(tx.value.msg);

      if (txStatus.state !== "accepted") {
        notify({
          type: "error",
          message: txStatus.memo || "There was an error while unpegging",
        });
      }
      console.log(
        "unpeg txStatus.state",
        txStatus.state,
        txStatus.memo,
        txStatus.code,
        tx.value.msg
      );

      return txStatus;
    },

    // TODO: Move this approval command to within peg and report status via store or some other means
    //       This has been done for convenience but we should not have to know in the view that
    //       approval is required before pegging as that is very much business domain knowledge
    async approve(address: Address, assetAmount: AssetAmount) {
      return await api.EthbridgeService.approveBridgeBankSpend(
        address,
        assetAmount
      );
    },

    async peg(assetAmount: AssetAmount) {
      const lockOrBurnFn = isOriginallySifchainNativeToken(assetAmount.asset)
        ? api.EthbridgeService.burnToSifchain
        : api.EthbridgeService.lockToSifchain;

      return await new Promise<TransactionStatus>(done => {
        const pegTx = lockOrBurnFn(
          store.wallet.sif.address,
          assetAmount,
          ETH_CONFIRMATIONS
        );

        subscribeToTx(pegTx);

        pegTx.onTxHash(hash => {
          done({
            hash: hash.txHash,
            memo: "Transaction Accepted",
            state: "accepted",
          });
        });
      });
    },
  };

  return actions;
};
