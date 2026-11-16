"use client";

import { useState } from "react";
import { kitchenPrepLists } from "@/lib/kitchen/today";
import { leftToPrep, prepProgress } from "@/lib/prep/prep";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePrepActions } from "@/state/actions/usePrepActions";

/** Today's prep lists; a tap anywhere on a row ticks it. */
export function KitchenPrep({ today, onLeave }: { today: string; onLeave: () => void }) {
  const { data, setView, t, f, fmt } = useApp();
  const guard = useGuard();
  const { toggleTask } = usePrepActions();
  const lists = kitchenPrepLists(data.prepLists, today);
  const names = new Map(data.recipes.map((recipe) => [recipe.id, recipe.name]));
  const [hideDone, setHideDone] = useState(false);

  if (!lists.length) {
    return (
      <div className="kitchen-empty">
        <p>{t("Nessuna prep list per oggi.")}</p>
        <button className="kitchen-button" type="button" onClick={() => { onLeave(); setView({ filter: "prep" }); }}>{t("Vai alle prep list")}</button>
      </div>
    );
  }
  return (
    <div className="kitchen-prep">
      <label className="kitchen-toggle"><input type="checkbox" checked={hideDone} onChange={(event) => setHideDone(event.target.checked)} /> {t("Nascondi le preparazioni fatte")}</label>
      {lists.map((list) => {
        const { done, total } = prepProgress(list);
        const tasks = hideDone ? list.tasks.filter((task) => !task.done) : list.tasks;
        return (
          <section key={list.id} className="kitchen-card">
            <header className="kitchen-card-head">
              <div>
                <h2>{list.name}</h2>
                <span className={list.date === today ? "" : "kitchen-warn"}>{list.date === today ? f.dateLabel(list.date) : fmt(t("Non è di oggi: {0}"), f.dateLabel(list.date))}</span>
              </div>
              <div className="kitchen-progress"><strong>{done}/{total}</strong><span><i style={{ width: total ? (done / total) * 100 + "%" : 0 }} /></span></div>
            </header>
            <ul className="kitchen-tasks">
              {tasks.map((task) => (
                <li key={task.id}>
                  <button type="button" className={"kitchen-task" + (task.done ? " done" : "")} aria-pressed={task.done} onClick={guard(() => toggleTask(list.id, task.id))}>
                    <span className="kitchen-check" aria-hidden="true">{task.done ? "✓" : ""}</span>
                    <span className="kitchen-task-main">
                      <strong>{task.name || t("Preparazione")}</strong>
                      {task.recipeIds.length || task.notes ? <small>{[task.recipeIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", "), task.notes].filter(Boolean).join(" · ")}</small> : null}
                    </span>
                    {task.quantity ? <span className="kitchen-qty">{leftToPrep(task)} <small>{task.unit}</small></span> : null}
                  </button>
                </li>
              ))}
              {tasks.length ? null : <li className="kitchen-hint">{t(list.tasks.length ? "Tutto fatto." : "Nessuna preparazione.")}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
