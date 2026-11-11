"use client";

import { useCallback } from "react";
import { useApp } from "@/state/AppProvider";

/** Runs an action and turns any error into a toast, so buttons never fail silently. */
export function useGuard() {
  const { notify, t } = useApp();
  return useCallback(<A extends unknown[]>(action: (...args: A) => Promise<unknown> | unknown) => async (...args: A) => {
    try { await action(...args); }
    catch (error) { notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true); }
  }, [notify, t]);
}
