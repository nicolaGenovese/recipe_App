"use client";

import { upsert } from "@/lib/num";
import type { PrepList } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

export function usePrepActions() {
  const { current, update, notify, t, fmt, closeDialog } = useApp();

  async function persistPrepList(list: PrepList): Promise<PrepList> {
    const saved = await api.savePrepList(list);
    update((data) => ({ ...data, prepLists: upsert(data.prepLists, saved) }));
    return saved;
  }

  async function savePrepList(list: PrepList, isNew: boolean) {
    if (!list.name.trim() || !list.date) { notify(t("Inserisci nome e data della prep list."), true); return; }
    await persistPrepList(list);
    closeDialog();
    notify(t(isNew ? "Prep list creata." : "Prep list salvata."));
  }

  /** Ticks a job straight from the list page, without opening the dialog. */
  async function toggleTask(listId: string, taskId: string) {
    const list = current().prepLists.find((row) => row.id === listId);
    if (!list) return;
    await persistPrepList({ ...list, tasks: list.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)) });
  }

  async function deletePrepList(id: string) {
    const list = current().prepLists.find((row) => row.id === id);
    if (!list || !window.confirm(fmt(t("Eliminare la prep list “{0}”? Questa azione non si può annullare."), list.name))) return;
    await api.deletePrepList(id);
    update((data) => ({ ...data, prepLists: data.prepLists.filter((row) => row.id !== id) }));
    closeDialog();
    notify(t("Prep list eliminata."));
  }

  return { savePrepList, toggleTask, deletePrepList };
}
