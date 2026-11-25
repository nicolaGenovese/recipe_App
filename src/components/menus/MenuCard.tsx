"use client";

import { availabilityLabel, dayNames, isAvailableAt } from "@/lib/menus/availability";
import { menuDishes, menuStats } from "@/lib/menus/menus";
import { localeFor } from "@/lib/i18n";
import { menuAllergenSummary } from "@/lib/recipes/allergens";
import type { Menu } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useMenuActions } from "@/state/actions/useMenuActions";

const PREVIEW = 6;

export function MenuCard({ menu }: { menu: Menu }) {
  const { data, gpRules, setView, openDialog, f, t, fmt, language } = useApp();
  const guard = useGuard();
  const { toggleActive } = useMenuActions();
  const dishes = menuDishes(menu, data.recipes);
  const stats = menuStats(menu, data.recipes, gpRules);
  const allergenCheck = menuAllergenSummary(dishes, data.stockItems, data.recipes);
  const when = availabilityLabel(menu, dayNames(localeFor(language)), t("Tutti i giorni"));
  const lowMargin = stats.costed > 0 && stats.averageMargin < gpRules.defaultMarginTarget;

  return (
    <article className={"menu-card" + (menu.active ? "" : " inactive")}>
      <header className="menu-card-head">
        <div>
          <span className={"menu-status" + (menu.active ? " on" : "")}>{t(menu.active ? "Attivo" : "Sospeso")}</span>
          <h2>{menu.name}</h2>
          {menu.description ? <p>{menu.description}</p> : null}
          {when ? (
            <span className="menu-when">
              <span>{when}</span>
              {menu.active ? <span className={"menu-now" + (isAvailableAt(menu.availability, new Date()) ? " on" : "")}>{t(isAvailableAt(menu.availability, new Date()) ? "Disponibile ora" : "Non disponibile ora")}</span> : null}
            </span>
          ) : null}
        </div>
        <button className="card-more" type="button" onClick={() => openDialog({ kind: "menuEditor", id: menu.id })} aria-label={t("Modifica menu")}>···</button>
      </header>
      <div className="menu-stats">
        <div><span>{t("Piatti")}</span><strong>{stats.dishes}</strong></div>
        <div className="cost-only"><span>{t("Costo medio")}</span><strong>{f.money(stats.averageCost)}</strong></div>
        <div className="cost-only"><span>{t("Prezzo medio")}</span><strong>{stats.averagePrice ? f.money(stats.averagePrice) : "—"}</strong></div>
        <div className="cost-only"><span>{t("Food cost")}</span><strong>{stats.foodCostPercent ? stats.foodCostPercent.toFixed(1) + "%" : "—"}</strong></div>
        <div className={"cost-only" + (lowMargin ? " warn" : "")}><span>{t("Margine medio")}</span><strong>{stats.costed ? stats.averageMargin.toFixed(1) + "%" : "—"}</strong></div>
      </div>
      {/* One calm line of chips instead of red sentences; the names are in the allergen matrix. */}
      {dishes.length ? (
        <div className="menu-flags">
          <button type="button" className={"menu-flag" + (allergenCheck.toCheck.length ? " todo" : " ok")} onClick={() => openDialog({ kind: "print", menuId: menu.id, mode: "matrix" })}
            title={allergenCheck.toCheck.length ? allergenCheck.toCheck.map((dish) => dish.name).join(", ") : undefined}>
            {allergenCheck.toCheck.length ? fmt(t("Allergeni da controllare {0}/{1}"), allergenCheck.toCheck.length, allergenCheck.dishes) : t("Allergeni controllati")}
          </button>
          {stats.unpriced ? <span className="menu-flag">{fmt(t("{0} senza prezzo"), stats.unpriced)}</span> : null}
          {stats.uncosted ? <span className="menu-flag">{fmt(t("{0} senza costi"), stats.uncosted)}</span> : null}
        </div>
      ) : null}
      <ul className="menu-dishes">
        {dishes.slice(0, PREVIEW).map((dish) => (
          <li key={dish.id}>
            <button type="button" onClick={() => openDialog({ kind: "recipeDetail", id: dish.id })}>{dish.name}</button>
            <span className="cost-only">{dish.sellingPrice ? f.money(dish.sellingPrice) : "—"}</span>
          </li>
        ))}
        {dishes.length > PREVIEW ? <li className="menu-more">{fmt(t("e altri {0}"), dishes.length - PREVIEW)}</li> : null}
        {dishes.length ? null : <li className="menu-more">{t("Nessun piatto: aggiungili da Modifica menu.")}</li>}
      </ul>
      <footer className="menu-card-actions">
        <button className="button button-secondary button-small" type="button" onClick={() => setView({ filter: "menu", menuId: menu.id, page: 1 })}>{t("Vedi piatti")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "prepList", menuId: menu.id })}>{t("Nuova prep list")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "print", menuId: menu.id })}>{t("Stampa")}</button>
        <button className="button button-quiet button-small" type="button" onClick={() => openDialog({ kind: "print", menuId: menu.id, mode: "matrix" })}>{t("Matrice allergeni")}</button>
        <button className="button button-quiet button-small" type="button" onClick={guard(() => toggleActive(menu.id))}>{t(menu.active ? "Sospendi" : "Attiva")}</button>
      </footer>
    </article>
  );
}
