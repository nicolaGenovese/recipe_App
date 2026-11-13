"use client";

import { useRef } from "react";
import { clone, dateKey, newId, num, upsert } from "@/lib/num";
import { applyDeliveries, isDeliveryClosed } from "@/lib/stock/deliveries";
import { newDraftReport, periodError, syncDraftLines } from "@/lib/stock/draft";
import { inventoryRow, nextStockCode } from "@/lib/stock/inventory";
import { draftReport, latestSubmitted } from "@/lib/stock/report";
import { findStockItemByName, stockSources } from "@/lib/stock/sources";
import { FREE, recipesUsing } from "@/lib/recipes/catalog";
import type { StockDelivery, StockItem, StockReport } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

/** Rows typed in the delivery dialog, before they are matched to products. */
export interface DeliveryRowInput { name: string; quantity: number; price: number }

export interface DeliveryInput {
  base: StockDelivery | null;
  invoiceNumber: string;
  date: string;
  supplier: string;
  invoiceAmount: string;
  rows: DeliveryRowInput[];
  updatePrices: boolean;
}

export function useStockActions() {
  const app = useApp();
  const { current, update, notify, t, fmt, gpRules, openDialog, closeDialog, setStockView } = app;
  const { syncRecipeCosts, saveRecipe } = useRecipeActions();
  const inventoryQueue = useRef<Promise<unknown>>(Promise.resolve());

  const sources = () => stockSources(current().stockItems, current().recipes);

  async function saveItem(item: StockItem): Promise<StockItem> {
    const saved = await api.saveStockItem(item);
    update((data) => ({ ...data, stockItems: upsert(data.stockItems, saved) }));
    return saved;
  }

  async function persistReport(report: StockReport): Promise<StockReport> {
    const saved = await api.saveReport(report);
    update((data) => ({ ...data, stockReports: upsert(data.stockReports, saved) }));
    return saved;
  }

  /** The draft as the dialog should show it: in step with current products and deliveries. */
  function prepareReport(id: string): StockReport | null {
    const found = current().stockReports.find((report) => report.id === id);
    if (!found) return null;
    return found.status === "draft" ? syncDraftLines(found, sources(), current().stockReports, current().stockDeliveries) : clone(found);
  }

  async function generateReport(dateFrom: string, dateTo: string) {
    const existing = draftReport(current().stockReports);
    if (existing) {
      openDialog({ kind: "stockReport", id: existing.id });
      notify(t("Esiste già una bozza: completala o eliminala prima di generarne un'altra."), true);
      return;
    }
    const error = periodError(dateFrom, dateTo, current().stockReports);
    if (error) { notify(t(error), true); return; }
    const saved = await persistReport(newDraftReport({
      id: newId(), dateFrom, dateTo, sources: sources(), reports: current().stockReports, deliveries: current().stockDeliveries, rules: gpRules
    }));
    openDialog({ kind: "stockReport", id: saved.id });
    notify(t("Report stock generato."));
  }

  async function saveDraft(report: StockReport) {
    await persistReport(report);
    notify(t("Bozza salvata."));
  }

  async function submitReport(report: StockReport) {
    if (num(report.netSales) <= 0 && !window.confirm(t("Le vendite nette sono a zero, quindi il GP non è calcolabile. Inviare comunque?"))) return;
    const saved = await persistReport({ ...report, status: "submitted", submittedAt: new Date().toISOString(), gpRules: { ...gpRules } });
    closeDialog();
    setStockView((view) => ({ open: view.open.includes(saved.id) ? view.open : [...view.open, saved.id] }));
    notify(t("Report inviato."));
  }

  async function reopenReport(report: StockReport) {
    const { gpRules: _frozen, ...rest } = report;
    await persistReport({ ...rest, status: "draft" });
    openDialog({ kind: "stockReport", id: report.id });
    notify(t("Report riaperto."));
  }

  async function deleteDraft(report: StockReport) {
    if (!window.confirm(t("Eliminare questa bozza? Questa azione non si può annullare."))) return;
    await api.deleteReport(report.id);
    update((data) => ({ ...data, stockReports: data.stockReports.filter((row) => row.id !== report.id) }));
    closeDialog();
    notify(t("Bozza eliminata."));
  }

  async function saveStockItem(item: Omit<StockItem, "code"> & { code?: string }, isNew: boolean) {
    const old = current().stockItems.find((row) => row.id === item.id);
    await saveItem({ ...(old || {}), ...item, code: item.code || old?.code || nextStockCode(current().stockItems) } as StockItem);
    await syncRecipeCosts();
    closeDialog();
    notify(t(isNew ? "Prodotto creato." : "Modifiche salvate."));
  }

  async function deleteStockItem(id: string) {
    const item = current().stockItems.find((row) => row.id === id);
    if (!item) return;
    const users = recipesUsing(id, current().recipes);
    const question = users.length
      ? fmt(t("“{0}” è usato in {1} ricette ({2}). Eliminandolo, in quelle ricette resta come voce libera con gli ultimi valori e non segue più il magazzino. Continuare?"), item.name, users.length, users.map((recipe) => recipe.name).join(", "))
      : fmt(t("Eliminare “{0}”? Questa azione non si può annullare."), item.name);
    if (!window.confirm(question)) return;
    await api.deleteStockItem(id);
    update((data) => ({ ...data, stockItems: data.stockItems.filter((row) => row.id !== id) }));
    // The rows keep their last values as free rows, so the recipes stay correct.
    for (const recipe of users) {
      await saveRecipe({ ...recipe, ingredients: recipe.ingredients.map((row) => (row.stockItemId === id ? { ...row, type: FREE, stockItemId: undefined } : row)) });
    }
    notify(t("Prodotto eliminato."));
  }

  /**
   * Adds a product to the catalogue straight from a recipe row, without leaving the recipe.
   * The price is the cost per unit typed in the row, so 1 unit of sale = 1 recipe unit.
   */
  async function createProduct(input: { name: string; supplier: string; unit: string; unitCost: number; allergens: string[]; kcal: number }): Promise<StockItem> {
    const existing = findStockItemByName(current().stockItems, input.name);
    if (existing) return existing;
    const saved = await saveItem({
      id: newId(), code: nextStockCode(current().stockItems), name: input.name.trim(), supplier: input.supplier.trim(), group: "",
      measurement: input.unit === "kg" ? "Kilo" : input.unit === "l" ? "Litre" : "Each", unitOfSale: input.unit, unitsPerPack: 1,
      price: Math.max(0, input.unitCost), initialStock: 0, recipeContent: 1, recipeUnit: input.unit || "kg", allergens: input.allergens, kcal: Math.max(0, input.kcal), parLevel: 0
    });
    notify(fmt(t("“{0}” aggiunto agli ingredienti del magazzino."), saved.name));
    return saved;
  }

  /** Products created before the inventory existed get a code the first time it is opened. */
  async function ensureStockCodes() {
    const missing = current().stockItems.filter((item) => !item.code).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of missing) await saveItem({ ...item, code: nextStockCode(current().stockItems) });
  }

  /** Saves a yellow inventory cell. Saves run one at a time, so fast tabbing cannot overwrite the store. */
  function saveInventoryCell(itemId: string, field: "parLevel" | "stock", value: number) {
    const item = current().stockItems.find((entry) => entry.id === itemId);
    if (!item) return;
    const amount = Math.max(0, value);
    let next: StockItem;
    if (field === "parLevel") next = { ...item, parLevel: amount };
    else {
      const shown = Math.round(inventoryRow(item, current().stockReports, current().stockDeliveries).stock * 1000) / 1000;
      if (amount === shown) return;
      next = { ...item, stockCount: { quantity: amount, date: dateKey(new Date()), at: new Date().toISOString() } };
    }
    update((data) => ({ ...data, stockItems: upsert(data.stockItems, next) }));
    inventoryQueue.current = inventoryQueue.current.then(() => api.saveStockItem(next)).catch((error) => {
      notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true);
      return app.reload();
    });
  }

  /** Keeps the open draft in step, so its summary is right before it is reopened. */
  async function syncDraftWithDeliveries(prices = new Map<string, number>()) {
    const draft = draftReport(current().stockReports);
    if (!draft) return;
    const updated = clone(draft);
    updated.lines.forEach((line) => { if (prices.has(line.itemId)) line.price = prices.get(line.itemId) as number; });
    await persistReport(applyDeliveries(updated, current().stockDeliveries, latestSubmitted(current().stockReports)));
  }

  /** The newest invoice sets the product price; an older one entered late does not. */
  async function updateProductPrices(delivery: StockDelivery) {
    const prices = new Map<string, number>();
    for (const line of delivery.lines) {
      const newer = current().stockDeliveries.some((other) => other.id !== delivery.id && other.date > delivery.date && other.lines.some((row) => row.itemId === line.itemId));
      if (!newer) prices.set(line.itemId, line.price);
    }
    for (const [id, price] of prices) {
      const item = current().stockItems.find((row) => row.id === id);
      if (item && num(item.price) !== price) await saveItem({ ...item, price });
    }
    return prices;
  }

  async function createMissingProducts(names: string[], supplier: string, rows: DeliveryRowInput[]) {
    for (const name of names) {
      const price = rows.find((row) => row.name.toLocaleLowerCase() === name.toLocaleLowerCase())?.price ?? 0;
      await saveItem({
        id: newId(), code: nextStockCode(current().stockItems), parLevel: 0, name, supplier, group: "", measurement: "Pack", unitOfSale: "",
        price, unitsPerPack: 1, initialStock: 0, recipeContent: 1, recipeUnit: "kg", kcal: 0, allergens: []
      });
    }
  }

  async function saveDelivery(input: DeliveryInput) {
    const { invoiceNumber, date, supplier } = input;
    if (!invoiceNumber || !date) { notify(t("Inserisci numero fattura e data."), true); return; }
    if (isDeliveryClosed({ date }, current().stockReports)) { notify(t("Questa data rientra in un report già inviato: per registrarla riapri il report."), true); return; }
    const rows = input.rows.filter((row) => row.name || row.quantity);
    if (!rows.length || rows.some((row) => !row.name || row.quantity <= 0)) { notify(t("Ogni riga deve avere prodotto e quantità."), true); return; }
    const sameKey = (a: unknown, b: unknown) => String(a || "").trim().toLocaleLowerCase() === String(b || "").trim().toLocaleLowerCase();
    const id = input.base?.id ?? newId();
    const duplicate = current().stockDeliveries.some((other) => other.id !== id && sameKey(other.invoiceNumber, invoiceNumber) && sameKey(other.supplier, supplier));
    if (duplicate && !window.confirm(fmt(t("La fattura {0} di questo fornitore è già registrata. Salvarla comunque?"), invoiceNumber))) return;
    const missing = Array.from(new Set(rows.filter((row) => !findStockItemByName(current().stockItems, row.name)).map((row) => row.name)));
    if (missing.length && !window.confirm(fmt(t("Questi prodotti non esistono e verranno creati: {0}. Continuare?"), missing.join(", ")))) return;
    await createMissingProducts(missing, supplier, rows);
    const delivery = await api.saveDelivery({
      ...(input.base || {}), id, invoiceNumber, date, supplier, invoiceAmount: input.invoiceAmount === "" ? null : num(input.invoiceAmount),
      createdAt: input.base?.createdAt || new Date().toISOString(),
      lines: rows.map((row) => {
        const item = findStockItemByName(current().stockItems, row.name) as StockItem;
        return { itemId: item.id, name: item.name, quantity: row.quantity, price: row.price };
      })
    });
    update((data) => ({ ...data, stockDeliveries: upsert(data.stockDeliveries, delivery) }));
    const prices = input.updatePrices ? await updateProductPrices(delivery) : new Map<string, number>();
    await syncRecipeCosts();
    await syncDraftWithDeliveries(prices);
    closeDialog();
    notify(missing.length ? t("Consegna salvata. Completa i dati dei nuovi prodotti in Inventario.") : t("Consegna salvata."));
  }

  async function deleteDelivery(delivery: StockDelivery) {
    if (!window.confirm(fmt(t("Eliminare la consegna {0}? La merce verrà tolta da report e giacenza."), delivery.invoiceNumber))) return;
    await api.deleteDelivery(delivery.id);
    update((data) => ({ ...data, stockDeliveries: data.stockDeliveries.filter((row) => row.id !== delivery.id) }));
    await syncDraftWithDeliveries();
    closeDialog();
    notify(t("Consegna eliminata."));
  }

  return {
    prepareReport, generateReport, saveDraft, submitReport, reopenReport, deleteDraft,
    saveStockItem, deleteStockItem, createProduct, ensureStockCodes, saveInventoryCell, saveDelivery, deleteDelivery
  };
}
