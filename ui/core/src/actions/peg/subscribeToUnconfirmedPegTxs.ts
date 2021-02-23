import { ActionContext } from "..";
import { PegTxEventEmitter } from "../../api/EthbridgeService/PegTxEventEmitter";
import { createSubscribeToTx } from "./utils/subscribeToTx";

// Define context for this
type PegContext = ActionContext<
  "SifService" | "EthbridgeService" | "EthereumService",
  "wallet" | "tx"
> & { ethConfirmations: number };

export const subscribeToUnconfirmedPegTxs = ({
  api,
  store,
  ethConfirmations,
}: PegContext) => (address: string) => {
  // Update a tx state in the store
  const subscribeToTx = createSubscribeToTx({ store });

  async function getSubscriptions() {
    const pendingTxs: PegTxEventEmitter[] = await api.EthbridgeService.fetchUnconfirmedLockBurnTxs(
      address,
      ethConfirmations
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
};
