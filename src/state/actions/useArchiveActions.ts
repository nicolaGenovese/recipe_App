"use client";

import { margin, portionCost, totalCost, allergens } from "@/lib/recipes/math";
import { newId, num } from "@/lib/num";
import { menusOfRecipe } from "@/lib/menus/menus";
import { normalizeSettings } from "@/lib/settings";
import type { Menu, PrepList, Recipe, Settings } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";
import { useSettingsActions } from "@/state/actions/useSettingsActions";

function download(filename: string, content: string, type: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
const today = () => new Date().toISOString().slice(0, 10);
const csvCell = (value: unknown) => "\"" + String(value ?? "").replaceAll("\"", "\"\"") + "\"";

/** Backup and exchange: the full JSON archive, a CSV of recipes, and importing a backup back in. */
export function useArchiveActions() {
  const { current, notify, t, fmt, gpRules, reload } = useApp();
  const { persistSettings } = useSettingsActions();

  function exportJson() {
    const data = current();
    download("recipe-studio-" + today() + ".json", JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), "application/json");
    notify(t("Archivio JSON esportato."));
  }

  function exportCsv() {
    const header = [t("Nome"), t("Categoria"), t("Porzioni"), t("Menu"), t("Base"), t("Ingredienti"), t("Costo totale"), t("Costo porzione"), t("Prezzo"), t("Margine teorico %"), t("Allergeni")];
    const rows = current().recipes.map((item) => [item.name, item.category, item.portions, menusOfRecipe(current().menus, item.id).map((menu) => menu.name).join(", "), item.archivedBatch ? t("Sì") : "No",
      (item.ingredients || []).map((row) => row.name + " (" + row.quantity + " " + row.unit + ")").join("; "),
      totalCost(item).toFixed(2), portionCost(item).toFixed(2), num(item.sellingPrice).toFixed(2), margin(item, gpRules).toFixed(1), allergens(item).join(", ")]);
    download("ricette-" + today() + ".csv", "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
    notify(t("File CSV pronto."));
  }

  async function importJson(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown> | Recipe[];
      const recipes = Array.isArray(data) ? data : (data.recipes as Recipe[]);
      if (!Array.isArray(recipes)) throw new Error(t("Il file non contiene un elenco di ricette."));
      // Backups made before stock was included simply have none of these lists.
      const list = (key: string) => (!Array.isArray(data) && Array.isArray(data[key]) ? (data[key] as { id: string }[]) : []);
      const stock = [["items", list("stockItems")], ["reports", list("stockReports")], ["deliveries", list("stockDeliveries")]] as const;
      const menus = list("menus") as Menu[];
      const prepLists = list("prepLists") as PrepList[];
      const counts = stock.map(([, rows]) => rows.length);
      const hasStock = counts.some(Boolean);
      const extra = menus.length || prepLists.length ? " " + fmt(t("Inclusi {0} menu e {1} prep list."), menus.length, prepLists.length) : "";
      const question = (hasStock
        ? fmt(t("Importare {0} ricette, {1} prodotti, {2} report e {3} consegne? Gli ID già presenti verranno aggiornati."), recipes.length, ...counts)
        : fmt(t("Importare {0} ricette? Gli ID già presenti verranno aggiornati."), recipes.length)) + extra;
      if (!window.confirm(question)) return;
      for (const item of recipes) if (item?.name?.trim()) await api.saveRecipe({ ...item, id: item.id || newId() });
      if (!Array.isArray(data) && data.settings) await persistSettings(normalizeSettings({ ...current().settings, ...(data.settings as Partial<Settings>) }));
      for (const [kind, rows] of stock) {
        for (const row of rows) {
          if (kind === "items") await api.saveStockItem(row as never);
          else if (kind === "reports") await api.saveReport(row as never);
          else await api.saveDelivery(row as never);
        }
      }
      for (const menu of menus) await api.saveMenu(menu);
      for (const prepList of prepLists) await api.savePrepList(prepList);
      await reload();
      notify(hasStock ? fmt(t("Importati: {0} ricette, {1} prodotti, {2} report, {3} consegne."), recipes.length, ...counts) : fmt(t("{0} ricette importate."), recipes.length));
    } catch (error) {
      notify(t("Importazione non riuscita:") + " " + t(error instanceof Error ? error.message : String(error)), true);
    }
  }

  return { exportJson, exportCsv, importJson };
}
