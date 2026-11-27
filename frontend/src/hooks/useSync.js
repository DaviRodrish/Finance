import { useSyncExternalStore } from "react";
import { getSyncState, subscribeSync } from "../services/sync";

export function useSync() {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}