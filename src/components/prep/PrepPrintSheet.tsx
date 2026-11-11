"use client";

import { leftToPrep } from "@/lib/prep/prep";
import type { PrepList } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

/** The paper version of a prep list: hidden on screen, the only thing printed. */
export function PrepPrintSheet({ list }: { list: PrepList }) {
  const { data, f, t } = useApp();
  const names = new Map(data.recipes.map((recipe) => [recipe.id, recipe.name]));
  const menus = data.menus.filter((menu) => list.menuIds.includes(menu.id)).map((menu) => menu.name);
  const tasks = list.tasks.filter((task) => task.name.trim());

  return (
    <div className="prep-print">
      <h3>{list.name}</h3>
      <p>{f.dateLabel(list.date)}{menus.length ? " · " + menus.join(", ") : ""}</p>
      <table>
        <thead><tr><th>✓</th><th>{t("Preparazione")}</th><th>{t("Da fare")}</th><th>{t("Per i piatti")}</th><th>{t("Note")}</th></tr></thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.done ? "☑" : "☐"}</td>
              <td>{task.name}</td>
              <td>{task.quantity ? leftToPrep(task) + " " + task.unit : ""}</td>
              <td>{task.recipeIds.map((id) => names.get(id)).filter(Boolean).join(", ")}</td>
              <td>{task.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
