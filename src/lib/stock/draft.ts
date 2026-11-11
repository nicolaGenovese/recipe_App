import { clone, num } from "@/lib/num";
import { applyDeliveries } from "@/lib/stock/deliveries";
import { buildReportLines, latestSubmitted, lineFromSource, nextReportNumber, summarizeReport } from "@/lib/stock/report";
import type { GpRules, StockDelivery, StockReport, StockSource } from "@/lib/types";

/** A new draft for a period: opening from the last submitted report, deliveries already counted. */
export function newDraftReport(input: {
  id: string; dateFrom: string; dateTo: string; sources: StockSource[]; reports: StockReport[]; deliveries: StockDelivery[]; rules: Partial<GpRules>;
}): StockReport {
  const last = latestSubmitted(input.reports);
  return applyDeliveries({
    id: input.id, number: nextReportNumber(input.reports), status: "draft", dateFrom: input.dateFrom, dateTo: input.dateTo, createdAt: new Date().toISOString(),
    lines: buildReportLines(input.sources, last), transfer: 0, netSales: 0, invoicesTotal: null,
    openingTotal: last ? summarizeReport(last, input.rules).closingTotal : null
  }, input.deliveries, last);
}

/** Brings an open draft up to date with products added or renamed since it was generated. */
export function syncDraftLines(report: StockReport, sources: StockSource[], reports: StockReport[], deliveries: StockDelivery[]): StockReport {
  const draft = clone(report);
  const previous = latestSubmitted(reports);
  sources.forEach((source) => {
    const line = draft.lines.find((row) => row.itemId === source.id);
    if (!line) draft.lines.push(lineFromSource(source, previous));
    else Object.assign(line, { name: source.name, supplier: source.supplier || "", group: source.group || "", measurement: source.measurement, unitOfSale: source.unitOfSale || "", unitsPerPack: num(source.unitsPerPack) || 1 });
  });
  return applyDeliveries(draft, deliveries, previous);
}

/** Validation for a new period; returns an Italian message key, or null when the period is fine. */
export function periodError(dateFrom: string, dateTo: string, reports: StockReport[]): string | null {
  if (!dateFrom || !dateTo || dateFrom > dateTo) return "Scegli un periodo valido.";
  const last = latestSubmitted(reports);
  if (last && dateFrom <= last.dateTo) return "Il periodo deve iniziare dopo la fine dell'ultimo report inviato.";
  return null;
}
