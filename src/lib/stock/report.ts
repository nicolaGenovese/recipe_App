import { num, round2, sum } from "@/lib/num";
import { isFood, KIND_LABELS, productKind, storedKind, type ProductKind } from "@/lib/stock/kind";
import { toSaleUnits } from "@/lib/stock/units";
import type { GpRules, ReportLine, StockReport, StockSource } from "@/lib/types";

export const BATCH_SUPPLIER = "Preparazioni interne";
/** Cleaning products and supplies get a section of their own, after the food, whoever sold them. */
const NON_FOOD_SECTIONS = (["cleaning", "supplies"] as ProductKind[]).map((kind) => ({ kind, name: KIND_LABELS[kind] }));

export function openingValue(line: ReportLine): number { return round2(toSaleUnits(line, line.opening) * num(line.price)); }
export function closingValue(line: ReportLine): number { return round2(toSaleUnits(line, line.closing) * num(line.price)); }
export function invoiceValue(line: ReportLine): number {
  return line.batch ? 0 : round2(num(line.invoiceQty) * num(line.price) + num(line.receivedValue));
}

/**
 * Food suppliers in alphabetical order, then internal batch preparations, then the cleaning
 * products and the supplies, each in its own section.
 */
export function supplierNames(lines: ReportLine[]): string[] {
  const names = Array.from(new Set(lines.filter((line) => !line.batch && isFood(line)).map((line) => line.supplier || "")));
  names.sort((a, b) => a.localeCompare(b));
  if (lines.some((line) => line.batch)) names.push(BATCH_SUPPLIER);
  NON_FOOD_SECTIONS.forEach((section) => { if (lines.some((line) => productKind(line) === section.kind)) names.push(section.name); });
  return names;
}
export function linesForSupplier(lines: ReportLine[], supplier: string): ReportLine[] {
  if (supplier === BATCH_SUPPLIER) return lines.filter((line) => line.batch);
  const section = NON_FOOD_SECTIONS.find((row) => row.name === supplier);
  if (section) return lines.filter((line) => productKind(line) === section.kind);
  return lines.filter((line) => !line.batch && isFood(line) && (line.supplier || "") === supplier);
}
export function supplierTotals(report: Pick<StockReport, "lines">): { supplier: string; total: number }[] {
  const lines = report.lines || [];
  return supplierNames(lines).map((supplier) => ({ supplier, total: sum(linesForSupplier(lines, supplier), closingValue) }));
}

export const DEFAULT_GP_RULES: Pick<GpRules, "target" | "includeTransfers" | "salesIncludeVat" | "salesVatRate"> = {
  target: 70, includeTransfers: true, salesIncludeVat: false, salesVatRate: 10
};

/** What the cleaning products and supplies cost in the period: kept apart from the cost of sales. */
export interface NonFoodSummary { opening: number; invoices: number; closing: number; used: number }

/** Opening, closing, invoices and cost of sales are food only; the GP is the food GP. */
export interface ReportSummary {
  openingTotal: number;
  closingTotal: number;
  nonFood: NonFoodSummary | null;
  invoicesAuto: number;
  invoicesTotal: number;
  transfer: number;
  salesEntered: number;
  netSales: number;
  costOfSales: number;
  gp: number | null;
  target: number;
  onTarget: boolean | null;
  rules: typeof DEFAULT_GP_RULES & Partial<GpRules>;
}

/** Rules come from the settings; a submitted report keeps the rules it was sent with. */
export function summarizeReport(report: StockReport, rules: Partial<GpRules> = {}): ReportSummary {
  const gpRules = { ...DEFAULT_GP_RULES, ...rules, ...(report.gpRules || {}) };
  const lines = report.lines || [];
  const others = lines.filter((line) => !isFood(line));
  const nonFoodOpening = round2(sum(others, openingValue));
  const nonFoodInvoices = round2(sum(others, invoiceValue));
  const nonFoodClosing = round2(sum(others, closingValue));
  const nonFood = others.length ? { opening: nonFoodOpening, invoices: nonFoodInvoices, closing: nonFoodClosing, used: round2(nonFoodOpening + nonFoodInvoices - nonFoodClosing) } : null;
  const closingTotal = round2(sum(lines, closingValue) - nonFoodClosing);
  // The stored opening is the previous report's food closing.
  const openingTotal = report.openingTotal === null || report.openingTotal === undefined ? round2(sum(lines, openingValue) - nonFoodOpening) : num(report.openingTotal);
  const invoicesAuto = round2(sum(lines, invoiceValue) + num(report.deliveryAdjustment) - nonFoodInvoices);
  // A total typed by hand is the food invoices: it replaces the automatic figure as it is.
  const manualInvoices = report.invoicesTotal as unknown;
  const invoicesTotal = manualInvoices === null || manualInvoices === undefined || manualInvoices === "" ? invoicesAuto : num(manualInvoices);
  const transfer = num(report.transfer);
  const salesEntered = num(report.netSales);
  const netSales = gpRules.salesIncludeVat ? round2(salesEntered / (1 + num(gpRules.salesVatRate) / 100)) : salesEntered;
  const costOfSales = round2(openingTotal + invoicesTotal + (gpRules.includeTransfers ? transfer : 0) - closingTotal);
  const gp = netSales > 0 ? ((netSales - costOfSales) / netSales) * 100 : null;
  const target = num(gpRules.target);
  const onTarget = gp === null || target <= 0 ? null : gp >= target;
  return { openingTotal, closingTotal, nonFood, invoicesAuto, invoicesTotal, transfer, salesEntered, netSales, costOfSales, gp, target, onTarget, rules: gpRules };
}

export function latestSubmitted(reports: StockReport[]): StockReport | null {
  return (reports || []).filter((report) => report.status === "submitted")
    .reduce<StockReport | null>((latest, report) => (!latest || num(report.number) > num(latest.number) ? report : latest), null);
}
export function nextReportNumber(reports: StockReport[]): number {
  return (reports || []).reduce((highest, report) => Math.max(highest, num(report.number)), 0) + 1;
}
export function draftReport(reports: StockReport[]): StockReport | null {
  return reports.find((report) => report.status === "draft") || null;
}

export function lineFromSource(source: StockSource, previous: StockReport | null): ReportLine {
  const before = (previous?.lines || []).find((row) => row.itemId === source.id);
  return {
    itemId: source.id, name: source.name, supplier: source.supplier || "", group: source.group || "",
    measurement: source.measurement, unitOfSale: source.unitOfSale || "", unitsPerPack: num(source.unitsPerPack) || 1,
    price: num(source.price), batch: Boolean(source.batch), ...storedKind(productKind(source)),
    opening: before ? num(before.closing) : num(source.stockCount ? source.stockCount.quantity : source.initialStock), invoiceQty: 0, delivered: 0, closing: 0
  };
}
export function buildReportLines(sources: StockSource[], previous: StockReport | null): ReportLine[] {
  return sources.map((source) => lineFromSource(source, previous));
}
