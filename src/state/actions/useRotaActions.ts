"use client";

import { useRef } from "react";
import { upsert } from "@/lib/num";
import type { RotaWeek } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

/** Saves rota weeks one after another, so fast typing can never overwrite a newer save with an older one. */
export function useRotaActions() {
  const { update, notify, t, reload } = useApp();
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function saveWeek(week: RotaWeek): Promise<RotaWeek | null> {
    update((data) => ({ ...data, rotaWeeks: upsert(data.rotaWeeks, week) }));
    const run = queue.current.then(async () => {
      const saved = await api.saveRotaWeek(week);
      update((data) => ({ ...data, rotaWeeks: upsert(data.rotaWeeks, saved) }));
      return saved;
    });
    queue.current = run.catch(() => undefined);
    return run.catch(async (error) => {
      notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true);
      await reload();
      return null;
    });
  }

  async function deleteWeek(id: string) {
    await queue.current;
    await api.deleteRotaWeek(id);
    update((data) => ({ ...data, rotaWeeks: data.rotaWeeks.filter((week) => week.id !== id) }));
  }

  return { saveWeek, deleteWeek };
}
