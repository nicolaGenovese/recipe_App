"use client";

import { upsert } from "@/lib/num";
import type { PrepList } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

/** Saves of ticked jobs, one after the other, so quick taps on a tablet never overwrite each other. */
let tickQueue: Promise<unknown> = Promise.resolve();

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

  /**
   * Ticks a job straight from the list page or the kitchen screen. The tick shows at once; the save
   * waits for the previous one and sends the list as it is by then, with every tick so far.
   */
  async function toggleTask(listId: string, taskId: string) {
    const list = current().prepLists.find((row) => row.id === listId);
    if (!list) return;
    const ticked = { ...list, tasks: list.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)) };
    update((data) => ({ ...data, prepLists: upsert(data.prepLists, ticked) }));
    const save = tickQueue.then(async () => {
      const latest = current().prepLists.find((row) => row.id === listId);
      if (!latest) return;
      const saved = await api.savePrepList(latest);
      // Keep later ticks made while this save was on its way.
      if (current().prepLists.find((row) => row.id === listId) === latest) update((data) => ({ ...data, prepLists: upsert(data.prepLists, saved) }));
    });
    tickQueue = save.catch(() => undefined);
    try { await save; }
    catch (error) {
      update((data) => ({ ...data, prepLists: upsert(data.prepLists, list) }));
      throw error;
    }
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
