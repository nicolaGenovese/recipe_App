import { num, round2 } from "@/lib/num";
import { deliveriesAfter } from "@/lib/stock/deliveries";
import { latestSubmitted } from "@/lib/stock/report";
import { toSaleUnits, toStockUnits } from "@/lib/stock/units";
import type { StockDelivery, StockItem, StockReport } from "@/lib/types";

type CountSource = Pick<StockItem, "id" | "stockCount" | "initialStock" | "measurement" | "unitsPerPack">;

/** A count typed in the inventory holds until a report is submitted after it. */
function activeCount(source: CountSource, last: StockReport | null) {
  const count = source.stockCount;
  return count && (!last || count.at > (last.submittedAt || last.dateTo)) ? count : null;
}
function receivedAfterCount(delivery: StockDelivery, count: NonNullable<StockItem["stockCount"]>): boolean {
  return delivery.date > count.date || (delivery.date === count.date && String(delivery.createdAt) > count.at);
}

/** Stock on hand: the last count or report closing, plus what arrived since. */
export function currentQuantity(source: CountSource, reports: StockReport[], deliveries: StockDelivery[] = []): number {
  const last = latestSubmitted(reports);
  const line = (last?.lines || []).find((row) => row.itemId === source.id);
  const count = activeCount(source, last);
  const received = deliveriesAfter(deliveries, last).filter((delivery) => !count || receivedAfterCount(delivery, count)).flatMap((delivery) => delivery.lines || [])
    .filter((row) => row.itemId === source.id).reduce((total, row) => total + num(row.quantity), 0);
  const base = count ? num(count.quantity) : line ? num(line.closing) : num(source.initialStock);
  return base + toStockUnits(source, received);
}

export type InventoryStatus = "none" | "reorder" | "ok";

export interface InventoryRow {
  stock: number;
  par: number;
  reorder: number;
  status: InventoryStatus;
  unitCost: number;
  value: number;
}

export function inventoryRow(source: StockItem, reports: StockReport[], deliveries: StockDelivery[] = []): InventoryRow {
  const stock = currentQuantity(source, reports, deliveries);
  const par = num(source.parLevel);
  const reorder = par > 0 ? Math.max(0, Math.round((par - stock) * 1000) / 1000) : 0;
  return {
    stock, par, reorder, status: par <= 0 ? "none" : reorder > 0 ? "reorder" : "ok",
    unitCost: toSaleUnits(source, 1) * num(source.price), value: round2(toSaleUnits(source, stock) * num(source.price))
  };
}

/** Next free code in the ING01, ING02… series. */
export function nextStockCode(items: Pick<StockItem, "code">[]): string {
  const highest = (items || []).reduce((max, item) => Math.max(max, Number(/^ING(\d+)$/i.exec(item.code || "")?.[1] ?? 0)), 0);
  return "ING" + String(highest + 1).padStart(2, "0");
}

export function availableInRecipeUnits(source: StockItem, reports: StockReport[], deliveries: StockDelivery[] = []): number {
  return toSaleUnits(source, currentQuantity(source, reports, deliveries)) * (num(source.recipeContent) || 1);
}

/** How many times the selected quantities can be made from what is in stock. */
export function maxBatches(rows: { quantity: number; available: number }[]): number {
  const needed = rows.filter((row) => num(row.quantity) > 0);
  if (!needed.length) return 0;
  return Math.floor(Math.min(...needed.map((row) => num(row.available) / num(row.quantity))) + 1e-9);
}
