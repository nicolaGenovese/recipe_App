"use client";

import { menuDishes, menuStats } from "@/lib/menus/menus";
import type { Menu } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useMenuActions } from "@/state/actions/useMenuActions";

const PREVIEW = 6;

export function MenuCard({ menu }: { menu: Menu }) {
  const { data, gpRules, setView, openDialog, f, t, fmt } = useApp();
  const guard = useGuard();
  const { toggleActive } = useMenuActions();
  const dishes = menuDishes(menu, data.recipes);
  const stats = menuStats(menu, data.recipes, gpRules);
  const lowMargin = stats.dishes > stats.unpriced && stats.averageMargin < gpRules.defaultMarginTarget;

  return (
    <article className={"menu-card" + (menu.active ? "" : " inactive")}>
      <header className="menu-card-head">
        <div>
          <span className={"menu-status" + (menu.active ? " on" : "")}>{t(menu.active ? "Attivo" : "Sospeso")}</span>
          <h3>{menu.name}</h3>
          {menu.description ? <p>{menu.description}</p> : null}
        </div>
        <button className="card-more" type="button" onClick={() => openDialog({ kind: "menuEditor", id: menu.id })} aria-label={t("Modifica menu")}>···</button>
      </header>
      <div className="menu-stats">
        <div><span>{t("Piatti")}</span><strong>{stats.dishes}</strong></div>
        <div><span>{t("Costo medio")}</span><strong>{f.money(stats.averageCost)}</strong></div>
        <div><span>{t("Prezzo medio")}</span><strong>{stats.averagePrice ? f.money(stats.averagePrice) : "—"}</strong></div>
        <div><span>{t("Food cost")}</span><strong>{stats.foodCostPercent ? stats.foodCostPercent.toFixed(1) + "%" : "—"}</strong></div>
        <div className={lowMargin ? "warn" : ""}><span>{t("Margine medio")}</span><strong>{stats.dishes > stats.unpriced ? stats.averageMargin.toFixed(1) + "%" : "—"}</strong></div>
      </div>
      {stats.unpriced ? <p className="menu-note">{fmt(stats.unpriced === 1 ? t("{0} piatto senza prezzo di vendita.") : t("{0} piatti senza prezzo di vendita."), stats.unpriced)}</p> : null}
      <ul className="menu-dishes">
        {dishes.slice(0, PREVIEW).map((dish) => (
          <li key={dish.id}>
            <button type="button" onClick={() => openDialog({ kind: "recipeDetail", id: dish.id })}>{dish.name}</button>
            <span>{dish.sellingPrice ? f.money(dish.sellingPrice) : "—"}</span>
          </li>
        ))}
        {dishes.length > PREVIEW ? <li className="menu-more">{fmt(t("e altri {0}"), dishes.length - PREVIEW)}</li> : null}
        {dishes.length ? null : <li className="menu-more">{t("Nessun piatto: aggiungili da Modifica menu.")}</li>}
      </ul>
      <footer className="menu-card-actions">
        <button className="button button-secondary button-small" type="button" onClick={() => setView({ filter: "menu", menuId: menu.id, page: 1 })}>{t("Vedi piatti")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "prepList", menuId: menu.id })}>{t("Nuova prep list")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "print", menuId: menu.id })}>{t("Stampa")}</button>
        <button className="button button-quiet button-small" type="button" onClick={guard(() => toggleActive(menu.id))}>{t(menu.active ? "Sospendi" : "Attiva")}</button>
      </footer>
    </article>
  );
}
