"use client";

import { leftToPrep, prepProgress, sortPrepLists } from "@/lib/prep/prep";
import type { PrepList } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePrepActions } from "@/state/actions/usePrepActions";

function PrepCard({ list }: { list: PrepList }) {
  const { data, openDialog, f, t, fmt } = useApp();
  const guard = useGuard();
  const { toggleTask } = usePrepActions();
  const names = new Map(data.recipes.map((recipe) => [recipe.id, recipe.name]));
  const menus = data.menus.filter((menu) => list.menuIds.includes(menu.id)).map((menu) => menu.name);
  const { done, total } = prepProgress(list);

  return (
    <article className="prep-card">
      <header className="prep-card-head">
        <div>
          <span className="menu-status on">{f.dateLabel(list.date)}</span>
          <h3>{list.name}</h3>
          <p>{menus.length ? menus.join(" · ") : t("Nessun menu collegato")}</p>
        </div>
        <div className="prep-progress" title={fmt(t("{0} di {1} fatte"), done, total)}>
          <strong>{done}/{total}</strong>
          <span><i style={{ width: total ? (done / total) * 100 + "%" : 0 }} /></span>
        </div>
      </header>
      <ul className="prep-card-tasks">
        {list.tasks.map((task) => (
          <li key={task.id} className={task.done ? "prep-done" : ""}>
            <label>
              <input type="checkbox" checked={task.done} onChange={guard(() => toggleTask(list.id, task.id))} />
              <span className="prep-task-name">{task.name}</span>
              {task.quantity ? <span className="prep-task-qty">{leftToPrep(task)} {task.unit}</span> : null}
            </label>
            {task.recipeIds.length ? <small>→ {task.recipeIds.map((id) => names.get(id) ?? t("Ricetta eliminata")).join(", ")}</small> : null}
          </li>
        ))}
        {list.tasks.length ? null : <li className="field-hint">{t("Nessuna preparazione.")}</li>}
      </ul>
      <footer className="menu-card-actions">
        <button className="button button-secondary button-small" type="button" onClick={() => openDialog({ kind: "prepList", id: list.id })}>{t("Apri")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "prepList", copyOf: list.id })}>{t("Duplica")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "prepLabels", id: list.id })}>{t("Etichette")}</button>
      </footer>
    </article>
  );
}

/** Prep lists, newest service first. Jobs can be ticked off right here. */
export function PrepView() {
  const { data, openDialog, t } = useApp();
  const lists = sortPrepLists(data.prepLists);
  if (!lists.length) {
    return (
      <section className="empty-state">
        <div className="empty-art"><span>✳</span><span>✓</span></div>
        <h3>{t("Nessuna prep list, per ora")}</h3>
        <p>{t("Scegli uno o più menu: le basi e le righe MEP dei piatti diventano le preparazioni da fare, ognuna con i suoi piatti.")}</p>
        <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "prepList" })}>{t("Crea una prep list")}</button>
      </section>
    );
  }
  return <section className="menu-grid prep-grid">{lists.map((list) => <PrepCard key={list.id} list={list} />)}</section>;
}
