import { describe, expect, it } from "vitest";
import { applyDeliveries, deliveryTotal, isDeliveryClosed } from "@/lib/stock/deliveries";
import { BATCH_SUPPLIER, closingValue, lineFromSource, summarizeReport, supplierNames } from "@/lib/stock/report";
import type { ReportLine, StockDelivery, StockReport, StockSource } from "@/lib/types";

const line = (over: Partial<ReportLine> = {}): ReportLine => ({
  itemId: "a", name: "Burro", supplier: "Latticini", group: "", measurement: "Kilo", unitOfSale: "kg", unitsPerPack: 1,
  price: 10, batch: false, opening: 0, invoiceQty: 0, delivered: 0, closing: 0, ...over
});
const report = (over: Partial<StockReport> = {}): StockReport => ({
  id: "r1", number: 1, status: "draft", dateFrom: "2026-11-01", dateTo: "2026-11-07", createdAt: "2026-11-01T00:00:00Z",
  lines: [], transfer: 0, netSales: 0, invoicesTotal: null, openingTotal: null, ...over
});

describe("summarizeReport", () => {
  const base = report({ openingTotal: 100, invoicesTotal: 300, transfer: 50, netSales: 1200 });

  it("computes cost of sales and GP with the default rules", () => {
    const summary = summarizeReport(base, { includeTransfers: true, salesIncludeVat: false });
    expect(summary.costOfSales).toBe(450);
    expect(summary.gp).toBeCloseTo(62.5);
  });

  it("removes VAT from sales and can leave transfers out", () => {
    const summary = summarizeReport(base, { includeTransfers: false, salesIncludeVat: true, salesVatRate: 20, target: 70 });
    expect(summary.costOfSales).toBe(400);
    expect(summary.netSales).toBe(1000);
    expect(summary.gp).toBeCloseTo(60);
    expect(summary.onTarget).toBe(false);
  });

  it("keeps the rules a submitted report was sent with", () => {
    const frozen = { ...base, gpRules: { includeTransfers: true, salesIncludeVat: false } };
    const summary = summarizeReport(frozen, { includeTransfers: false, salesIncludeVat: true, salesVatRate: 20 });
    expect(summary.costOfSales).toBe(450);
    expect(summary.netSales).toBe(1200);
  });

  it("has no GP without sales and no verdict without a target", () => {
    expect(summarizeReport(report()).gp).toBeNull();
    expect(summarizeReport({ ...base }, { target: 0 }).onTarget).toBeNull();
  });

  it("counts opening, closing and invoices from the lines when no totals are typed", () => {
    const summary = summarizeReport(report({ lines: [line({ opening: 2, closing: 1, invoiceQty: 3 })], netSales: 100 }));
    expect(summary.openingTotal).toBe(20);
    expect(summary.closingTotal).toBe(10);
    expect(summary.invoicesAuto).toBe(30);
    expect(summary.costOfSales).toBe(40);
  });
});

describe("report lines", () => {
  it("values single pieces per pack", () => {
    expect(closingValue(line({ measurement: "Each", unitsPerPack: 12, price: 6, closing: 6 }))).toBe(3);
  });

  it("lists suppliers alphabetically with batch preparations last", () => {
    const lines = [line({ supplier: "Zeta" }), line({ batch: true }), line({ supplier: "Alfa" })];
    expect(supplierNames(lines)).toEqual(["Alfa", "Zeta", BATCH_SUPPLIER]);
  });

  it("opens from the previous closing, else from the count, else from the initial stock", () => {
    const source = { id: "a", name: "Burro", measurement: "Kilo", initialStock: 5, batch: false } as StockSource;
    expect(lineFromSource(source, null).opening).toBe(5);
    expect(lineFromSource({ ...source, stockCount: { quantity: 3, date: "2026-11-01", at: "x" } }, null).opening).toBe(3);
    expect(lineFromSource(source, report({ lines: [line({ closing: 7 })] })).opening).toBe(7);
  });
});

describe("deliveries", () => {
  const delivery = (over: Partial<StockDelivery> = {}): StockDelivery => ({
    id: "d1", invoiceNumber: "F1", date: "2026-11-03", supplier: "Latticini", invoiceAmount: null, createdAt: "2026-11-03T10:00:00Z",
    lines: [{ itemId: "a", name: "Burro", quantity: 2, price: 10 }], ...over
  });

  it("adds received goods to the draft lines and the invoice difference to the adjustment", () => {
    const draft = applyDeliveries(report({ lines: [line()] }), [delivery({ invoiceAmount: 25 })], null);
    expect(draft.lines[0].receivedQty).toBe(2);
    expect(draft.lines[0].receivedValue).toBe(20);
    expect(draft.deliveryAdjustment).toBe(5);
    expect(summarizeReport(draft).invoicesAuto).toBe(25);
  });

  it("keeps the value of deleted products in the adjustment", () => {
    const draft = applyDeliveries(report({ lines: [] }), [delivery()], null);
    expect(draft.deliveryAdjustment).toBe(20);
  });

  it("closes deliveries covered by the last submitted report", () => {
    const sent = report({ status: "submitted", dateTo: "2026-11-05" });
    expect(isDeliveryClosed(delivery(), [sent])).toBe(true);
    expect(isDeliveryClosed(delivery({ date: "2026-11-06" }), [sent])).toBe(false);
    expect(deliveryTotal(delivery({ invoiceAmount: 30 }))).toBe(30);
  });
});
