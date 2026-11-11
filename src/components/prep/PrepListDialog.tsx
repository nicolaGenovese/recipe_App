"use client";

import { useState } from "react";
import { PrepPlanPanel } from "@/components/prep/PrepPlanPanel";
import { PrepPrintSheet } from "@/components/prep/PrepPrintSheet";
import { PrepTaskRow } from "@/components/prep/PrepTaskRow";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { Datalist, TextField } from "@/components/ui/Field";
import { dishesOfMenus } from "@/lib/menus/menus";
import { clone, dateKey, newId } from "@/lib/num";
import { blankTask, generatePrepTasks, mergeGeneratedTasks } from "@/lib/prep/prep";
import type { AppData, PrepList, PrepTask } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePrepActions } from "@/state/actions/usePrepActions";

/** The list the dialog starts from: an existing one, a fresh copy of one, or a new one for a menu. */
function startingList(data: AppData, today: string, defaultName: string, id?: string, copyOf?: string, menuId?: string): { list: PrepList; isNew: boolean } {
  const now = new Date().toISOString();
  const existing = id ? data.prepLists.find((row) => row.id === id) : undefined;
  if (existing) return { list: clone(existing), isNew: false };
  const source = copyOf ? data.prepLists.find((row) => row.id === copyOf) : undefined;
  if (source) {
    return {
      isNew: true,
      list: { ...clone(source), id: newId(), date: today, createdAt: now, updatedAt: now,
        tasks: source.tasks.map((task) => ({ ...clone(task), id: newId(), done: false, onHand: 0 })) }
    };
  }
  const menu = data.menus.find((row) => row.id === menuId);
  const menuIds = menu ? [menu.id] : data.menus.filter((row) => row.active).map((row) => row.id);
  const tasks = menu ? generatePrepTasks(dishesOfMenus(data.menus, menuIds, data.recipes), data.recipes, {}, { includeMep: true }) : [];
  return { isNew: true, list: { id: newId(), name: menu ? menu.name : defaultName, date: today, menuIds, portions: {}, tasks, createdAt: now, updatedAt: now } };
}

export function PrepListDialog({ id, copyOf, menuId }: { id?: string; copyOf?: string; menuId?: string }) {
  const { data, closeDialog, openDialog, notify, t, fmt } = useApp();
  const guard = useGuard();
  const { savePrepList, deletePrepList } = usePrepActions();
  const [{ list: initial, isNew }] = useState(() => startingList(data, dateKey(new Date()), t("Prep del giorno"), id, copyOf, menuId));
  const [list, setList] = useState<PrepList>(initial);
  const [includeMep, setIncludeMep] = useState(true);

  const patch = (change: Partial<PrepList>) => setList((old) => ({ ...old, ...change }));
  const patchTask = (taskId: string, change: Partial<PrepTask>) => setList((old) => ({ ...old, tasks: old.tasks.map((task) => (task.id === taskId ? { ...task, ...change } : task)) }));
  const moveTask = (index: number, step: number) => setList((old) => {
    const tasks = [...old.tasks];
    const [row] = tasks.splice(index, 1);
    tasks.splice(Math.max(0, Math.min(tasks.length, index + step)), 0, row);
    return { ...old, tasks };
  });

  const dishes = dishesOfMenus(data.menus, list.menuIds, data.recipes);
  const done = list.tasks.filter((task) => task.done).length;

  function rebuild() {
    if (!dishes.length) { notify(t("Scegli almeno un menu con dei piatti."), true); return; }
    const generated = generatePrepTasks(dishes, data.recipes, list.portions, { includeMep });
    const tasks = mergeGeneratedTasks(list.tasks, generated);
    patch({ tasks });
    notify(generated.length ? fmt(t("{0} preparazioni dai piatti."), generated.length) : t("I piatti non hanno basi o MEP da preparare: aggiungi le righe a mano."), !generated.length);
  }

  const submit = guard(() => savePrepList({ ...list, tasks: list.tasks.filter((task) => task.name.trim()) }, isNew));

  return (
    <Dialog size="wide">
      <DialogHeader kicker={t("PREP LIST")} title={isNew ? t("Nuova prep list") : initial.name}
        subtitle={t("Le preparazioni da fare prima del servizio, ognuna con i piatti a cui serve.")} />
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="dialog-body">
          <div className="prep-edit">
            <div className="form-grid">
              <TextField label={t("Nome *")} name="prepName" value={list.name} onChange={(name) => patch({ name })} placeholder={t("Es. Pranzo di domenica")} required />
              <TextField label={t("Data del servizio *")} name="prepDate" type="date" value={list.date} onChange={(date) => patch({ date })} required />
            </div>

            <PrepPlanPanel list={list} dishes={dishes} includeMep={includeMep} onIncludeMep={setIncludeMep} onChange={patch} onRebuild={rebuild} hasAuto={list.tasks.some((task) => task.auto)} />

            <div className="prep-tasks-head">
              <h4>{fmt(t("Preparazioni ({0})"), list.tasks.length)}</h4>
              <span className="field-hint">{fmt(t("{0} di {1} fatte"), done, list.tasks.length)}</span>
            </div>
            <div className="stock-table-wrap">
              <table className="stock-table prep-table">
                <thead>
                  <tr>{["Fatto", "Preparazione", "Serve", "Pronto", "Da fare", "Unità", "Per i piatti", "Note", ""].map((label) => <th key={label}>{label ? t(label) : ""}</th>)}</tr>
                </thead>
                <tbody>
                  {list.tasks.map((task, index) => (
                    <PrepTaskRow key={task.id} task={task} index={index} count={list.tasks.length} dishes={dishes}
                      onChange={(change) => patchTask(task.id, change)} onMove={(step) => moveTask(index, step)}
                      onRemove={() => patch({ tasks: list.tasks.filter((other) => other.id !== task.id) })} />
                  ))}
                </tbody>
              </table>
            </div>
            {list.tasks.length ? null : <p className="field-hint prep-empty">{t("Nessuna preparazione: usa “Genera dai piatti” o aggiungile a mano.")}</p>}
            <button className="button button-secondary button-small stock-add-line" type="button" onClick={() => patch({ tasks: [...list.tasks, blankTask()] })}>{t("Aggiungi preparazione")}</button>
            <Datalist id="prepBaseNames" values={data.recipes.filter((recipe) => recipe.archivedBatch).map((recipe) => recipe.name)} />
          </div>
          <PrepPrintSheet list={list} />
        </div>
        <footer className="dialog-footer">
          <div>
            {isNew ? <span /> : (
              <>
                <button className="button button-quiet" type="button" onClick={guard(() => deletePrepList(list.id))}>{t("Elimina")}</button>
                <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "prepList", copyOf: list.id })}>{t("Duplica")}</button>
                <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "prepLabels", id: list.id })}>{t("Etichette")}</button>
              </>
            )}
          </div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={() => window.print()}>{t("Stampa")}</button>
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
            <button className="button button-primary" type="submit">{t(isNew ? "Crea prep list" : "Salva")}</button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
