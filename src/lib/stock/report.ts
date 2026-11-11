import { num, round2, sum } from "@/lib/num";
import { toSaleUnits } from "@/lib/stock/units";
import type { GpRules, ReportLine, StockReport, StockSource } from "@/lib/types";

export const BATCH_SUPPLIER = "Preparazioni interne";

export function openingValue(line: ReportLine): number { return round2(toSaleUnits(line, line.opening) * num(line.price)); }
export function closingValue(line: ReportLine): number { return round2(toSaleUnits(line, line.closing) * num(line.price)); }
export function invoiceValue(line: ReportLine): number {
  return line.batch ? 0 : round2(num(line.invoiceQty) * num(line.price) + num(line.receivedValue));
}

/** Suppliers in alphabetical order, with internal batch preparations always last. */
export function supplierNames(lines: ReportLine[]): string[] {
  const names = Array.from(new Set(lines.filter((line) => !line.batch).map((line) => line.supplier || "")));
  names.sort((a, b) => a.localeCompare(b));
  if (lines.some((line) => line.batch)) names.push(BATCH_SUPPLIER);
  return names;
}
export function linesForSupplier(lines: ReportLine[], supplier: string): ReportLine[] {
  return lines.filter((line) => (supplier === BATCH_SUPPLIER ? line.batch : !line.batch && (line.supplier || "") === supplier));
}
export function supplierTotals(report: Pick<StockReport, "lines">): { supplier: string; total: number }[] {
  const lines = report.lines || [];
  return supplierNames(lines).map((supplier) => ({ supplier, total: sum(linesForSupplier(lines, supplier), closingValue) }));
}

export const DEFAULT_GP_RULES: Pick<GpRules, "target" | "includeTransfers" | "salesIncludeVat" | "salesVatRate"> = {
  target: 70, includeTransfers: true, salesIncludeVat: false, salesVatRate: 10
};

export interface ReportSummary {
  openingTotal: number;
  closingTotal: number;
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
  const closingTotal = sum(lines, closingValue);
  const openingTotal = report.openingTotal === null || report.openingTotal === undefined ? sum(lines, openingValue) : num(report.openingTotal);
  const invoicesAuto = round2(sum(lines, invoiceValue) + num(report.deliveryAdjustment));
  const manualInvoices = report.invoicesTotal as unknown;
  const invoicesTotal = manualInvoices === null || manualInvoices === undefined || manualInvoices === "" ? invoicesAuto : num(manualInvoices);
  const transfer = num(report.transfer);
  const salesEntered = num(report.netSales);
  const netSales = gpRules.salesIncludeVat ? round2(salesEntered / (1 + num(gpRules.salesVatRate) / 100)) : salesEntered;
  const costOfSales = round2(openingTotal + invoicesTotal + (gpRules.includeTransfers ? transfer : 0) - closingTotal);
  const gp = netSales > 0 ? ((netSales - costOfSales) / netSales) * 100 : null;
  const target = num(gpRules.target);
  const onTarget = gp === null || target <= 0 ? null : gp >= target;
  return { openingTotal, closingTotal, invoicesAuto, invoicesTotal, transfer, salesEntered, netSales, costOfSales, gp, target, onTarget, rules: gpRules };
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
    price: num(source.price), batch: Boolean(source.batch),
    opening: before ? num(before.closing) : num(source.stockCount ? source.stockCount.quantity : source.initialStock), invoiceQty: 0, delivered: 0, closing: 0
  };
}
export function buildReportLines(sources: StockSource[], previous: StockReport | null): ReportLine[] {
  return sources.map((source) => lineFromSource(source, previous));
}
