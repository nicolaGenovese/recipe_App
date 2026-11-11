"use client";

import { useRef, useState } from "react";
import { dishesOfMenus } from "@/lib/menus/menus";
import { num } from "@/lib/num";
import { lineCost, lineNetRevenue, parseSalesCsv, salesTotals } from "@/lib/performance/sales";
import type { SalesLine } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePerformanceActions } from "@/state/actions/usePerformanceActions";

interface Row { key: string; recipeId?: string; name: string; quantity: string; revenue: string }

const keyOf = (line: Pick<SalesLine, "recipeId" | "name">) => line.recipeId ?? "name:" + line.name.trim().toLocaleLowerCase();

/** Dishes sold in a week: typed in, or imported from the till as a CSV file. */
export function SalesTab({ weekId }: { weekId: string }) {
  const { data, gpRules, f, t, fmt, notify } = useApp();
  const guard = useGuard();
  const { saveSales } = usePerformanceActions();
  const file = useRef<HTMLInputElement>(null);
  const stored = data.salesWeeks.find((week) => week.id === weekId);

  const [rows, setRows] = useState<Row[]>(() => {
    // Dishes of the active menus first, in menu order, then anything else that was sold.
    const menuDishes = dishesOfMenus(data.menus, data.menus.filter((menu) => menu.active).map((menu) => menu.id), data.recipes);
    const lines = new Map((stored?.lines ?? []).map((line) => [keyOf(line), line]));
    const list: Row[] = menuDishes.map((recipe) => {
      const line = lines.get(recipe.id);
      lines.delete(recipe.id);
      return { key: recipe.id, recipeId: recipe.id, name: recipe.name, quantity: line ? String(line.quantity) : "", revenue: line?.revenue ? String(line.revenue) : "" };
    });
    for (const [key, line] of lines) list.push({ key, recipeId: line.recipeId, name: line.name, quantity: String(line.quantity), revenue: line.revenue ? String(line.revenue) : "" });
    return list;
  });
  const [netSales, setNetSales] = useState(stored?.netSales ? String(stored.netSales) : "");
  const [dirty, setDirty] = useState(false);

  const recipes = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const lines: SalesLine[] = rows.filter((row) => num(row.quantity) > 0).map((row) => ({
    ...(row.recipeId ? { recipeId: row.recipeId } : {}), name: row.name, quantity: num(row.quantity), revenue: row.revenue.trim() ? num(row.revenue) : null
  }));
  const totals = salesTotals({ lines, netSales: netSales.trim() ? num(netSales) : null }, data.recipes, gpRules);

  const change = (key: string, patch: Partial<Row>) => { setRows((old) => old.map((row) => (row.key === key ? { ...row, ...patch } : row))); setDirty(true); };

  async function importFile(input: File) {
    const imported = parseSalesCsv(await input.text(), data.recipes);
    if (!imported.length) { notify(t("Nel file non ho trovato righe con nome e quantità."), true); return; }
    setRows((old) => {
      const next = old.map((row) => ({ ...row, quantity: "", revenue: "" }));
      for (const line of imported) {
        const key = keyOf(line);
        const found = next.find((row) => row.key === key);
        if (found) { found.quantity = String(line.quantity); found.revenue = line.revenue ? String(line.revenue) : ""; }
        else next.push({ key, recipeId: line.recipeId, name: line.name, quantity: String(line.quantity), revenue: line.revenue ? String(line.revenue) : "" });
      }
      return next;
    });
    setDirty(true);
    const unmatched = imported.filter((line) => !line.recipeId).length;
    notify(fmt(t("Importate {0} righe dalla cassa, {1} senza ricetta. Controlla e salva."), imported.length, unmatched));
  }

  const save = guard(async () => { await saveSales({ id: weekId, lines, netSales: netSales.trim() ? num(netSales) : null }); setDirty(false); });

  return (
    <div className="perf-sales">
      <div className="safety-bar">
        <label className="perf-net">{f.withCurrency(t("Vendite food nette dalla cassa €"))}
          <input type="number" step="0.01" min="0" value={netSales} placeholder={totals.linesNet.toFixed(2)} onChange={(event) => { setNetSales(event.target.value); setDirty(true); }} />
        </label>
        <span className="rota-actions-spacer" />
        <button className="button button-quiet button-small" type="button" onClick={() => file.current?.click()}>{t("Importa CSV dalla cassa")}</button>
        <input ref={file} className="visually-hidden" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => { const input = event.target.files?.[0]; if (input) void guard(() => importFile(input))(); event.target.value = ""; }} />
        <button className="button button-primary button-small" type="button" disabled={!dirty} onClick={save}>{t(dirty ? "Salva vendite" : "Salvato")}</button>
      </div>
      <p className="field-hint">{t("Scrivi quanti piatti hai venduto. Se la cassa dà l'incasso della riga (IVA inclusa) lo uso, altrimenti uso il prezzo del menu. Il CSV deve avere nome del piatto, quantità e, se c'è, incasso.")}</p>
      <div className="stock-table-wrap">
        <table className="stock-table perf-sales-table">
          <thead><tr><th>{t("Piatto")}</th><th>{t("Venduti")}</th><th>{f.withCurrency(t("Incasso IVA incl. €"))}</th><th>{t("Prezzo menu")}</th><th>{t("Netto")}</th><th>{t("Costo teorico")}</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const recipe = row.recipeId ? recipes.get(row.recipeId) : undefined;
              const line = { recipeId: row.recipeId, name: row.name, quantity: num(row.quantity), revenue: row.revenue.trim() ? num(row.revenue) : null };
              return (
                <tr key={row.key} className={recipe ? "" : "perf-unmatched"}>
                  <td>{row.name}{recipe ? null : <small className="perf-tag">{t("senza ricetta")}</small>}</td>
                  <td><input type="number" min="0" step="1" value={row.quantity} aria-label={t("Venduti") + " · " + row.name} onChange={(event) => change(row.key, { quantity: event.target.value })} /></td>
                  <td><input type="number" min="0" step="0.01" value={row.revenue} aria-label={t("Incasso") + " · " + row.name} onChange={(event) => change(row.key, { revenue: event.target.value })} /></td>
                  <td className="stock-value">{recipe ? f.money(recipe.sellingPrice) : "—"}</td>
                  <td className="stock-value">{line.quantity ? f.money(lineNetRevenue(line, recipe, gpRules)) : "—"}</td>
                  <td className="stock-value">{line.quantity && recipe ? f.money(lineCost(line, recipe)) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="stock-total">
              <td>{t("Totale")}</td><td>{totals.dishes}</td><td /><td />
              <td className="stock-value">{f.money(totals.linesNet)}</td>
              <td className="stock-value">{f.money(totals.theoreticalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length ? null : <p className="field-hint">{t("Nessun piatto nei menu attivi: importa un CSV o attiva un menu.")}</p>}
    </div>
  );
}
