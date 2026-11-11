import { num, round2, sum } from "@/lib/num";
import { latestSubmitted } from "@/lib/stock/report";
import type { StockDelivery, StockReport } from "@/lib/types";

export function deliveryLinesTotal(delivery: Pick<StockDelivery, "lines">): number {
  return sum(delivery.lines || [], (line) => num(line.quantity) * num(line.price));
}
function hasInvoiceAmount(delivery: Pick<StockDelivery, "invoiceAmount">): boolean {
  const amount = delivery.invoiceAmount as unknown;
  return amount !== null && amount !== undefined && amount !== "";
}
/** The invoice amount wins over the line total when it was typed in. */
export function deliveryTotal(delivery: StockDelivery): number {
  return hasInvoiceAmount(delivery) ? num(delivery.invoiceAmount) : deliveryLinesTotal(delivery);
}
/** A delivery covered by the last submitted report is frozen inside that report. */
export function isDeliveryClosed(delivery: Pick<StockDelivery, "date">, reports: StockReport[]): boolean {
  const last = latestSubmitted(reports);
  return Boolean(last) && delivery.date <= (last as StockReport).dateTo;
}
export function deliveriesAfter(deliveries: StockDelivery[], previous: StockReport | null): StockDelivery[] {
  return (deliveries || []).filter((delivery) => !previous || delivery.date > previous.dateTo);
}

/** Everything received since the previous report counts, so a gap between periods loses nothing. */
export function applyDeliveries(report: StockReport, deliveries: StockDelivery[], previous: StockReport | null): StockReport {
  const lines = new Map(report.lines.map((line) => [line.itemId, line]));
  report.lines.forEach((line) => { line.receivedQty = 0; line.receivedValue = 0; });
  let adjustment = 0;
  deliveriesAfter(deliveries, previous).filter((delivery) => delivery.date <= report.dateTo).forEach((delivery) => {
    (delivery.lines || []).forEach((row) => {
      const value = num(row.quantity) * num(row.price);
      const line = lines.get(row.itemId);
      if (line) {
        line.receivedQty = num(line.receivedQty) + num(row.quantity);
        line.receivedValue = round2(num(line.receivedValue) + value);
      } else adjustment += value; // The product was deleted, but the invoice was still paid.
    });
    if (hasInvoiceAmount(delivery)) adjustment += num(delivery.invoiceAmount) - deliveryLinesTotal(delivery);
  });
  report.deliveryAdjustment = round2(adjustment);
  return report;
}
