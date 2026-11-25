import "server-only";
import { createHash } from "node:crypto";
import { applyPosEvent, refundOf, saleOf } from "@/lib/orders/orders";
import { eventIdOf, readPosPayload, summaryOf } from "@/lib/orders/pos";
import type { PosEvent, PosLine, StoredOrder } from "@/lib/orders/types";
import { kitchenToday } from "@/lib/server/guards";
import type { OrderStore } from "@/lib/server/store/types";

const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Order id in the app: a hash of the till's id, so any till id is safe in a URL and steady over notices. */
export const orderIdOf = (externalId: string) => "o_" + sha(externalId).slice(0, 24);

export interface Received {
  duplicate: boolean;
  events: { kind: string; summary: string }[];
}

/** Writes the till part of an order, starting again if another notice for the same order wrote first. */
async function updateOrder(orders: OrderStore, externalId: string, event: PosEvent, test: boolean): Promise<StoredOrder | null> {
  const id = orderIdOf(externalId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await orders.get(id);
    const applied = applyPosEvent(before?.pos ?? null, event, new Date().toISOString(), test);
    if (!applied.pos) return before;
    const pos = { ...applied.pos, externalId };
    if (await orders.putPos(id, pos, applied.status, before?.version ?? 0)) return { id, status: applied.status ?? before?.status ?? "open", pos, kitchen: before?.kitchen ?? {}, version: (before?.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  }
  throw new Error("Comanda modificata da troppi avvisi insieme.");
}

/**
 * Handles one till notice: logs it (a copy sent again is answered without doing anything twice),
 * updates the kitchen orders and records paid receipts and refunds as sales. Test orders never
 * become sales. If something fails the notice is forgotten, so the till's retry gets handled.
 */
export async function receivePos(orders: OrderStore, raw: string, body: unknown, headers: Record<string, string>, test = false): Promise<Received> {
  const key = eventIdOf(body, headers) ?? "sha256:" + sha(raw);
  const rowId = await orders.logEvent(key, raw.slice(0, 3000));
  if (rowId === null) return { duplicate: true, events: [] };
  try {
    const events = readPosPayload(body, headers);
    const { config } = await orders.config();
    const results: Received["events"] = [];
    for (const [index, event] of events.entries()) {
      // A new order without any id gets the notice's, so it still appears once.
      const externalId = event.orderId ?? (event.kind === "order" || event.kind === "update" ? key + ":" + index : undefined);
      const before = externalId ? await orders.get(orderIdOf(externalId)) : null;
      const order = externalId && event.kind !== "refund" && event.kind !== "unknown" ? await updateOrder(orders, externalId, event, test) : before;
      if (!test && !order?.pos.test) await recordSale(orders, event, externalId, before, key + ":" + index, config.centsPrices === true);
      results.push({ kind: event.kind, summary: summaryOf(event) });
    }
    if (!events.length) results.push({ kind: "unknown", summary: "Non riconosciuto" });
    const ok = results.some((row) => row.kind !== "unknown");
    await orders.finishEvent(rowId, Array.from(new Set(results.map((row) => row.kind))).join(","), ok, results.map((row) => row.summary).join(" | ").slice(0, 300));
    return { duplicate: false, events: results };
  } catch (error) {
    await orders.dropEvent(rowId).catch(() => undefined);
    throw error;
  }
}

/**
 * Paid receipts become sales, under the order id when there is one: a till that sends both
 * "payment" and "order completed" for the same bill still counts it once. Refunds, and voids of an
 * order already paid, are stored as negative sales.
 */
async function recordSale(orders: OrderStore, event: PosEvent, externalId: string | undefined, before: StoredOrder | null, fallbackId: string, cents: boolean) {
  const day = kitchenToday(event.at ? new Date(event.at) : new Date());
  const known: PosLine[] = before?.pos.lines ?? [];
  if (event.kind === "paid") {
    const lines = event.lines.length ? event.lines : known;
    if (lines.length) await orders.saveSale(saleOf(externalId ?? event.receiptId ?? fallbackId, day, lines, cents));
    return;
  }
  if (event.kind === "refund") {
    const id = event.receiptId ?? externalId ?? fallbackId;
    const paid = event.lines.length ? saleOf(id, day, event.lines.map((line) => ({ ...line, voided: false })), cents) : externalId ? await orders.getSale(externalId) : null;
    if (paid?.lines.length) await orders.saveSale(refundOf("refund:" + (event.receiptId ?? fallbackId), day, paid));
    return;
  }
  if (event.kind === "void" && externalId && before?.pos.paid && !event.lines.length) {
    const paid = await orders.getSale(externalId);
    if (paid?.lines.length) await orders.saveSale(refundOf("refund:" + externalId + ":void", day, paid));
  }
}
