"use client";

import { useState } from "react";
import { menuDishes, sortMenus } from "@/lib/menus/menus";
import { analyseMenu, type MenuClass } from "@/lib/performance/sales";
import { useApp } from "@/state/AppProvider";

export const CLASS_LABELS: Record<MenuClass, [string, string]> = {
  star: ["Star", "Vende molto e rende bene: tienilo così."],
  plowhorse: ["Cavallo da tiro", "Vende molto ma rende poco: rivedi porzione, costo o prezzo."],
  puzzle: ["Enigma", "Rende bene ma vende poco: mettilo in evidenza o cambia descrizione."],
  dog: ["Cane", "Vende poco e rende poco: valuta di toglierlo."]
};

/** Which dishes sell and which pay, over the last weeks of sales. */
export function MenuAnalysisTab({ weekId }: { weekId: string }) {
  const { data, gpRules, f, t } = useApp();
  const menus = sortMenus(data.menus);
  const [menuId, setMenuId] = useState(menus.find((menu) => menu.active)?.id ?? "");
  const [span, setSpan] = useState(4);
  const weeks = [...data.salesWeeks].filter((week) => week.id <= weekId).sort((a, b) => b.id.localeCompare(a.id)).slice(0, span);
  const menu = menus.find((row) => row.id === menuId);
  const rows = analyseMenu(weeks, data.recipes, gpRules, menu ? menuDishes(menu, data.recipes).map((recipe) => recipe.id) : undefined);

  return (
    <div className="perf-analysis">
      <div className="safety-bar">
        <label>{t("Menu")}
          <select value={menuId} onChange={(event) => setMenuId(event.target.value)}>
            <option value="">{t("Tutti i piatti venduti")}</option>
            {menus.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <label>{t("Periodo")}
          <select value={span} onChange={(event) => setSpan(Number(event.target.value))}>
            {[1, 4, 8, 13].map((value) => <option key={value} value={value}>{value === 1 ? t("Questa settimana") : value + " " + t("settimane")}</option>)}
          </select>
        </label>
        <span className="field-hint">{weeks.length} {t("settimane con vendite")}</span>
      </div>
      <div className="perf-legend">
        {(Object.keys(CLASS_LABELS) as MenuClass[]).map((kind) => <span key={kind}><b className={"perf-class " + kind}>{t(CLASS_LABELS[kind][0])}</b> {t(CLASS_LABELS[kind][1])}</span>)}
      </div>
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead><tr><th>{t("Piatto")}</th><th>{t("Venduti")}</th><th>{t("Mix %")}</th><th>{t("Prezzo netto")}</th><th>{t("Costo")}</th><th>{t("Margine")}</th><th>{t("Margine totale")}</th><th>{t("Classe")}</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.recipeId}>
                <td>{row.name}</td>
                <td>{row.sold}</td>
                <td>{row.mix.toFixed(1)}%</td>
                <td className="stock-value">{f.money(row.netPrice)}</td>
                <td className="stock-value">{f.money(row.cost)}</td>
                <td className="stock-value">{f.money(row.margin)}</td>
                <td className="stock-value">{f.money(row.totalMargin)}</td>
                <td><b className={"perf-class " + row.kind} title={t(CLASS_LABELS[row.kind][1])}>{t(CLASS_LABELS[row.kind][0])}</b></td>
              </tr>
            ))}
            {rows.length ? null : <tr><td colSpan={8} className="safety-empty">{t("Nessuna vendita nel periodo.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="field-hint">{t("Un piatto è popolare se vende almeno il 70% della quota media; rende bene se il suo margine è almeno la media pesata sulle vendite. Senza i costi degli ingredienti il margine è il prezzo netto.")}</p>
    </div>
  );
}
