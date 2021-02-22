import { reactive } from "@vue/reactivity";

import { TransactionStatus } from "../entities";

// Store for reporting on current tx status
export type TxStore = {
  // txs as required by blockchain if we end up needing them
  eth: { [hash: string]: TransactionStatus };
  // sif: { [hash: string]: TransactionStatus };
};

export const tx = reactive<TxStore>({ eth: {} }) as TxStore;
