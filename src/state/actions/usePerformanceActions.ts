"use client";

import { newId, upsert } from "@/lib/num";
import type { SalesWeek, WasteLog } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

export type WasteDraft = Omit<WasteLog, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string };

export function usePerformanceActions() {
  const { current, update, notify, t, closeDialog } = useApp();

  async function saveWaste(draft: WasteDraft) {
    if (!draft.name.trim() || !(draft.quantity > 0)) { notify(t("Indica cosa è stato buttato e quanto."), true); return; }
    if (!draft.by.trim()) { notify(t("Indica chi registra lo spreco."), true); return; }
    const now = new Date().toISOString();
    const saved = await api.saveWasteLog({ ...draft, id: draft.id ?? newId(), createdAt: draft.createdAt ?? now, updatedAt: now });
    update((data) => ({ ...data, wasteLogs: upsert(data.wasteLogs, saved) }));
    closeDialog();
    notify(t("Spreco registrato."));
  }

  async function deleteWaste(id: string) {
    if (!window.confirm(t("Eliminare questa registrazione? Questa azione non si può annullare."))) return;
    await api.deleteWasteLog(id);
    update((data) => ({ ...data, wasteLogs: data.wasteLogs.filter((log) => log.id !== id) }));
    closeDialog();
    notify(t("Registrazione eliminata."));
  }

  async function saveSales(week: Omit<SalesWeek, "createdAt" | "updatedAt">) {
    const old = current().salesWeeks.find((row) => row.id === week.id);
    const now = new Date().toISOString();
    const saved = await api.saveSalesWeek({ ...week, createdAt: old?.createdAt ?? now, updatedAt: now });
    update((data) => ({ ...data, salesWeeks: upsert(data.salesWeeks, saved) }));
    notify(t("Vendite salvate."));
    return saved;
  }

  return { saveWaste, deleteWaste, saveSales };
}
