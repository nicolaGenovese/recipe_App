import "server-only";
import { createLocalStore } from "@/lib/server/store/local-store";
import { createNeonStore } from "@/lib/server/store/neon-store";
import type { Store } from "@/lib/server/store/types";

let store: Store | null = null;

/** Neon when DATABASE_URL is set, otherwise the local JSON file. Created once per server process. */
export function getStore(): Store {
  if (!store) {
    const url = process.env.DATABASE_URL?.trim();
    store = url ? createNeonStore(url) : createLocalStore();
  }
  return store;
}

export type { StockKind, Store } from "@/lib/server/store/types";
