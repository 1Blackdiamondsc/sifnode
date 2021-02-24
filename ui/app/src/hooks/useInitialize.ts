import { watchEffect } from "@vue/runtime-core";
import { useCore } from "./useCore";

export function useInitialize() {
  const { actions, store } = useCore();
  // initialize subscriptions
  watchEffect((onInvalidateEffect) => {
    console.log(
      "subscribeToUnconfirmedPegTxs watcher",
      store.wallet.eth.address
    );
    // TODO: subscriptions will be accessed from subscriptions.peg.unconfirmedPegTxs()
    const unsubscribe = actions.peg.subscribeToUnconfirmedPegTxs(
      store.wallet.eth.address
    );
    onInvalidateEffect(unsubscribe);
  });
}
