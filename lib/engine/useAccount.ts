"use client";

import { useSyncExternalStore } from "react";
import { accountStore } from "./store";

export function useAccount() {
  return useSyncExternalStore(
    accountStore.subscribe,
    accountStore.getState,
    accountStore.getServerState,
  );
}
