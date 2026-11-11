"use client";

import { num } from "@/lib/num";
import { dishesUsingBase, leftToPrep } from "@/lib/prep/prep";
import type { PrepTask, Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

interface Props {
  task: PrepTask;
  index: number;
  count: number;
  /** Dishes of the chosen menus, offered first when linking. */
  dishes: Recipe[];
  onChange: (change: Partial<PrepTask>) => void;
  onMove: (step: number) => void;
  onRemove: () => void;
}

export function PrepTaskRow({ task, index, count, dishes, onChange, onMove, onRemove }: Props) {
  const { data, t } = useApp();
  const byId = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const others = data.recipes.filter((recipe) => !recipe.archivedBatch && !dishes.some((dish) => dish.id === recipe.id)).sort((a, b) => a.name.localeCompare(b.name));
  const linkable = (rows: Recipe[]) => rows.filter((recipe) => !task.recipeIds.includes(recipe.id));

  /** Naming a job after a base recipe links that base and, if no dish is linked yet, the dishes that use it. */
  function rename(name: string) {
    const base = data.recipes.find((recipe) => recipe.archivedBatch && recipe.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (!base) { onChange({ name, ...(task.baseRecipeId && !task.auto ? { baseRecipeId: undefined } : {}) }); return; }
    const users = dishesUsingBase(base, dishes.length ? dishes : data.recipes, data.recipes).map((dish) => dish.id);
    onChange({ name, baseRecipeId: base.id, ...(task.recipeIds.length ? {} : { recipeIds: users }) });
  }

  return (
    <tr className={task.done ? "prep-done" : ""}>
      <td><input type="checkbox" checked={task.done} onChange={(event) => onChange({ done: event.target.checked })} aria-label={t("Fatto")} /></td>
      <td className="prep-name-cell">
        <input value={task.name} list="prepBaseNames" onChange={(event) => rename(event.target.value)} aria-label={t("Preparazione")} placeholder={t("Es. Impasto pizza")} />
        {task.baseRecipeId ? <small className="prep-base-tag">{t("Base")}: {byId.get(task.baseRecipeId)?.name ?? "—"}</small> : null}
      </td>
      <td><input type="number" min="0" step="0.01" value={task.quantity || ""} onChange={(event) => onChange({ quantity: Math.max(0, num(event.target.value)) })} aria-label={t("Serve")} /></td>
      <td><input type="number" min="0" step="0.01" value={task.onHand || ""} onChange={(event) => onChange({ onHand: Math.max(0, num(event.target.value)) })} aria-label={t("Pronto")} /></td>
      <td className="stock-value">{task.quantity ? leftToPrep(task) : "—"}</td>
      <td><input className="prep-unit" value={task.unit} onChange={(event) => onChange({ unit: event.target.value })} aria-label={t("Unità")} /></td>
      <td className="prep-dishes-cell">
        <div className="prep-chips">
          {task.recipeIds.map((recipeId) => (
            <span key={recipeId} className="prep-chip">
              {byId.get(recipeId)?.name ?? t("Ricetta eliminata")}
              <button type="button" aria-label={t("Rimuovi")} onClick={() => onChange({ recipeIds: task.recipeIds.filter((other) => other !== recipeId) })}>×</button>
            </span>
          ))}
          <select value="" aria-label={t("Collega un piatto")} onChange={(event) => event.target.value && onChange({ recipeIds: [...task.recipeIds, event.target.value] })}>
            <option value="">{t("+ piatto")}</option>
            {linkable(dishes).length ? <optgroup label={t("Nei menu scelti")}>{linkable(dishes).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</optgroup> : null}
            {linkable(others).length ? <optgroup label={t("Altre ricette")}>{linkable(others).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</optgroup> : null}
          </select>
        </div>
      </td>
      <td><input value={task.notes ?? ""} onChange={(event) => onChange({ notes: event.target.value })} aria-label={t("Note")} /></td>
      <td className="prep-row-tools">
        <button className="card-action" type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("Sposta su")}>↑</button>
        <button className="card-action" type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("Sposta giù")}>↓</button>
        <button className="card-action" type="button" onClick={onRemove} aria-label={t("Rimuovi")}>×</button>
      </td>
    </tr>
  );
}
