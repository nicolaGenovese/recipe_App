import { requireContext } from "@/lib/server/auth/context";
import { audit, onlyStockCountChanged } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { HttpError, isStockKind, parseStock } from "@/lib/server/validation";
import type { StockDelivery, StockItem, StockReport } from "@/lib/types";

/** POST /api/stock/items | reports | deliveries creates or updates one record. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ kind: string }> }) => {
  const { kind } = await params;
  if (!isStockKind(kind)) throw new HttpError(404, "Risorsa non trovata.");
  const context = await requireContext(request);
  const record = parseStock(kind, await readJson(request));
  if (kind === "items") {
    const item = record as StockItem;
    const before = await context.store.getRecord("items", item.id);
    // Counting stock may change only the stock on hand; anything else on a product needs "stock.manage".
    if (!context.can("stock.manage") && !(context.can("stock.count") && onlyStockCountChanged(before, item))) context.require("stock.manage");
    const saved = await context.store.saveRecord("items", item);
    if (before && before.price !== item.price) await audit(context, "price", item.name, { from: before.price, to: item.price, supplier: item.supplier }, true);
    return json(saved);
  }
  if (kind === "reports") {
    context.require("stock.manage");
    return json(await context.store.saveRecord("reports", record as StockReport));
  }
  context.require("stock.deliveries");
  return json(await context.store.saveRecord("deliveries", record as StockDelivery));
});
