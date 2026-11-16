"use client";

import { newId, upsert } from "@/lib/num";
import { droppedPhotos, missingPhotos, photoIdsOf } from "@/lib/safety/photos";
import { evaluate } from "@/lib/safety/rules";
import type { SafetyLog } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

/** A record as a dialog fills it: everything but the fields the app sets itself. Distributes over each kind of record. */
export type SafetyDraft = SafetyLog extends infer L ? (L extends SafetyLog ? Omit<L, "id" | "ok" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string } : never) : never;

/** Saves and deletes food safety records. A failed check must say what was done about it. */
export function useSafetyActions() {
  const { current, update, notify, t, fmt, closeDialog } = useApp();

  /** Saves a record; true when it was saved, false when something is missing (the message says what). */
  async function saveLog(draft: SafetyDraft): Promise<boolean> {
    const now = new Date().toISOString();
    const rules = current().settings.foodSafety;
    const log = evaluate({ ...draft, id: draft.id ?? newId(), ok: true, createdAt: draft.createdAt ?? now, updatedAt: now } as SafetyLog, rules);
    if (!log.by.trim()) { notify(t("Indica chi ha fatto il controllo."), true); return false; }
    if (!log.ok && !log.action?.trim()) { notify(t("Il controllo non è a norma: scrivi l'azione correttiva."), true); return false; }
    const missing = rules.requireTemperaturePhotos ? missingPhotos(log) : [];
    if (missing.length) { notify(fmt(t("Manca la foto della temperatura: {0}."), missing.map((label) => t(label)).join(", ")), true); return false; }
    const before = current().safetyLogs.find((row) => row.id === log.id);
    const saved = await api.saveSafetyLog(log);
    update((data) => ({ ...data, safetyLogs: upsert(data.safetyLogs, saved) }));
    // Photos replaced or removed in this version are no longer needed.
    for (const id of droppedPhotos(before, saved)) api.deletePhoto(id).catch(() => undefined);
    closeDialog();
    notify(saved.ok ? t("Registrazione salvata.") : t("Registrazione salvata con un'anomalia."), !saved.ok);
    return true;
  }

  async function deleteLog(id: string) {
    if (!window.confirm(t("Eliminare questa registrazione? Questa azione non si può annullare."))) return;
    const log = current().safetyLogs.find((row) => row.id === id);
    await api.deleteSafetyLog(id);
    update((data) => ({ ...data, safetyLogs: data.safetyLogs.filter((row) => row.id !== id) }));
    for (const photo of log ? photoIdsOf(log) : []) api.deletePhoto(photo).catch(() => undefined);
    closeDialog();
    notify(t("Registrazione eliminata."));
  }

  return { saveLog, deleteLog };
}
