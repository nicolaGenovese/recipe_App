"use client";

import { newId, upsert } from "@/lib/num";
import { evaluate } from "@/lib/safety/rules";
import type { SafetyLog } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

/** A record as a dialog fills it: everything but the fields the app sets itself. Distributes over each kind of record. */
export type SafetyDraft = SafetyLog extends infer L ? (L extends SafetyLog ? Omit<L, "id" | "ok" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string } : never) : never;

/** Saves and deletes food safety records. A failed check must say what was done about it. */
export function useSafetyActions() {
  const { current, update, notify, t, closeDialog } = useApp();

  async function saveLog(draft: SafetyDraft) {
    const now = new Date().toISOString();
    const log = evaluate({ ...draft, id: draft.id ?? newId(), ok: true, createdAt: draft.createdAt ?? now, updatedAt: now } as SafetyLog, current().settings.foodSafety);
    if (!log.by.trim()) { notify(t("Indica chi ha fatto il controllo."), true); return; }
    if (!log.ok && !log.action?.trim()) { notify(t("Il controllo non è a norma: scrivi l'azione correttiva."), true); return; }
    const saved = await api.saveSafetyLog(log);
    update((data) => ({ ...data, safetyLogs: upsert(data.safetyLogs, saved) }));
    closeDialog();
    notify(saved.ok ? t("Registrazione salvata.") : t("Registrazione salvata con un'anomalia."), !saved.ok);
  }

  async function deleteLog(id: string) {
    if (!window.confirm(t("Eliminare questa registrazione? Questa azione non si può annullare."))) return;
    await api.deleteSafetyLog(id);
    update((data) => ({ ...data, safetyLogs: data.safetyLogs.filter((log) => log.id !== id) }));
    closeDialog();
    notify(t("Registrazione eliminata."));
  }

  return { saveLog, deleteLog };
}
