import { describe, expect, it } from "vitest";
import { allergensToFill } from "@/lib/recipes/catalog";
import { syncDraftLines, newDraftReport } from "@/lib/stock/draft";
import { isFood, productKind } from "@/lib/stock/kind";
import { productForm, productFromForm } from "@/lib/stock/productForm";
import { BATCH_SUPPLIER, linesForSupplier, summarizeReport, supplierNames } from "@/lib/stock/report";
import { recipeSources, stockSources } from "@/lib/stock/sources";
import type { ReportLine, StockItem, StockReport } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "p1", name: "Burro", supplier: "Latticini", group: "", measurement: "Kilo", unitOfSale: "kg", unitsPerPack: 1, price: 10,
  initialStock: 0, recipeContent: 1, recipeUnit: "kg", allergens: [], kcal: 0, ...over
});
const line = (over: Partial<ReportLine> = {}): ReportLine => ({
  itemId: "a", name: "Burro", supplier: "Latticini", group: "", measurement: "Kilo", unitOfSale: "kg", unitsPerPack: 1,
  price: 10, batch: false, opening: 0, invoiceQty: 0, delivered: 0, closing: 0, ...over
});
const report = (over: Partial<StockReport> = {}): StockReport => ({
  id: "r1", number: 1, status: "draft", dateFrom: "2026-11-01", dateTo: "2026-11-07", createdAt: "2026-11-01T00:00:00Z",
  lines: [], transfer: 0, netSales: 0, invoicesTotal: null, openingTotal: null, ...over
});

describe("product kinds", () => {
  it("reads products from before kinds, and anything unknown, as food", () => {
    expect(productKind(item())).toBe("food");
    expect(productKind(item({ kind: "cleaning" }))).toBe("cleaning");
    expect(productKind({ kind: "weird" })).toBe("food");
    expect(isFood(item({ kind: "supplies" }))).toBe(false);
  });

  it("never asks for the allergens of cleaning products and supplies", () => {
    expect(allergensToFill(item({ allergensChecked: false }))).toBe(true);
    expect(allergensToFill(item({ allergensChecked: false, kind: "cleaning" }))).toBe(false);
    expect(allergensToFill(item({ allergensChecked: false, kind: "supplies" }))).toBe(false);
  });

  it("keeps cleaning products out of recipes but in the stock report", () => {
    const items = [item(), item({ id: "p2", name: "Degreaser", kind: "cleaning" })];
    expect(recipeSources(items, []).map((source) => source.name)).toEqual(["Burro"]);
    expect(stockSources(items, []).map((source) => source.name)).toEqual(["Burro", "Degreaser"]);
  });

  it("saves the kind from the product sheet, and nothing for food", () => {
    const cleaning = productFromForm({ ...productForm(item()), kind: "cleaning" }, "p1");
    expect(cleaning.kind).toBe("cleaning");
    expect(productForm(cleaning).kind).toBe("cleaning");
    expect("kind" in productFromForm(productForm(item()), "p1")).toBe(false);
  });
});

describe("non-food in the stock report", () => {
  const lines = [
    line({ itemId: "a", supplier: "Latticini", opening: 2, invoiceQty: 3, closing: 1 }),
    line({ itemId: "b", name: "Degreaser", supplier: "Latticini", kind: "cleaning", price: 12, opening: 1, invoiceQty: 2, closing: 1 }),
    line({ itemId: "c", name: "Foil", supplier: "Zeta", kind: "supplies", price: 5, opening: 0, invoiceQty: 1, closing: 0 }),
    line({ itemId: "d", name: "Ragù", batch: true, price: 3 })
  ];

  it("puts cleaning products and supplies in sections of their own, after the food", () => {
    expect(supplierNames(lines)).toEqual(["Latticini", BATCH_SUPPLIER, "Pulizia e igiene", "Materiale di consumo"]);
    expect(linesForSupplier(lines, "Latticini").map((row) => row.itemId)).toEqual(["a"]);
    expect(linesForSupplier(lines, "Pulizia e igiene").map((row) => row.itemId)).toEqual(["b"]);
  });

  it("leaves them out of the cost of sales and the GP, and says what they cost", () => {
    const summary = summarizeReport(report({ lines, netSales: 100 }));
    expect(summary.openingTotal).toBe(20);
    expect(summary.invoicesAuto).toBe(30);
    expect(summary.closingTotal).toBe(10);
    expect(summary.costOfSales).toBe(40);
    expect(summary.gp).toBeCloseTo(60);
    expect(summary.nonFood).toEqual({ opening: 12, invoices: 29, closing: 12, used: 29 });
  });

  it("opens the next report from the food closing, even with a cleaning product added since", () => {
    const sent = report({ status: "submitted", lines, netSales: 100 });
    const next = newDraftReport({
      id: "r2", dateFrom: "2026-11-08", dateTo: "2026-11-14", reports: [sent], deliveries: [], rules: {},
      sources: stockSources([item({ id: "a" }), item({ id: "b", name: "Degreaser", kind: "cleaning", price: 12 }), item({ id: "n", name: "Gloves", kind: "supplies", initialStock: 4 })], [])
    });
    expect(next.openingTotal).toBe(10);
    const summary = summarizeReport(next);
    expect(summary.openingTotal).toBe(10);
    expect(summary.nonFood?.opening).toBe(52);
  });

  it("moves a product to its new section in the open draft", () => {
    const draft = report({ lines: [line({ itemId: "p1" })] });
    const synced = syncDraftLines(draft, stockSources([item({ kind: "cleaning" })], []), [], []);
    expect(synced.lines[0].kind).toBe("cleaning");
    const back = syncDraftLines(synced, stockSources([item()], []), [], []);
    expect("kind" in back.lines[0]).toBe(false);
  });
});
