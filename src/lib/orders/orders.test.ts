import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allReady, applyPosEvent, lineKey, normalizeOrdersConfig, resolveRecipe, saleOf, stationsOf, toKitchenOrder } from "@/lib/orders/orders";
import { eventIdOf, kindOf, readPosPayload } from "@/lib/orders/pos";
import { mergeSalesWeeks, posSalesWeeks } from "@/lib/orders/sales";
import type { PosOrder } from "@/lib/orders/types";
import { verifySignature } from "@/lib/server/pos/signature";
import type { Recipe } from "@/lib/types";

const NOW = "2026-11-25T19:00:00.000Z";
const LATER = "2026-11-25T19:05:00.000Z";

describe("till notices from different brands", () => {
  it("reads the documented Recipe Studio format", () => {
    const [event] = readPosPayload({
      event: "order.created", id: "evt_1",
      order: {
        id: "A-1001", number: "1001", table: "12", covers: 4, server: "Marta", channel: "Sala", allergies: ["Glutine"],
        lines: [
          { id: "1", name: "Margherita", plu: "101", quantity: 2, course: "Principali", category: "Pizze", modifiers: ["Senza basilico"], note: "ben cotta", total: 19 },
          { id: "2", name: "Tiramisù", quantity: 1, course: "Dolci", held: true, total: 6.5 }
        ]
      }
    });
    expect(event).toMatchObject({ kind: "order", orderId: "A-1001", number: "1001", table: "12", covers: 4, server: "Marta", channel: "Sala", allergies: ["Glutine"] });
    expect(event.lines[0]).toMatchObject({ id: "1", name: "Margherita", plu: "101", quantity: 2, course: "Principali", category: "Pizze", modifiers: ["Senza basilico"], note: "ben cotta", total: 19 });
    expect(event.lines[1]).toMatchObject({ held: true, total: 6.5 });
    expect(eventIdOf({ event: "order.created", id: "evt_1", order: {} }, {})).toBe("evt_1");
  });

  it("reads a Square-style order with prices in pence and variations", () => {
    const [event] = readPosPayload({
      merchant_id: "M1", type: "order.created", event_id: "e-9",
      data: { type: "order", id: "ORD9", object: { order: {
        id: "ORD9", state: "OPEN", ticket_name: "Bar 3",
        line_items: [
          { uid: "li-1", name: "Burger", quantity: "2", variation_name: "Double", catalog_object_id: "CAT1", note: "medium rare",
            modifiers: [{ name: "Cheddar", quantity: "1" }, { name: "Bacon", quantity: "2" }], total_money: { amount: 3200, currency: "GBP" } },
          { uid: "li-2", name: "Fries", quantity: "1", variation_name: "Regular", base_price_money: { amount: 450, currency: "GBP" } }
        ]
      } } }
    });
    expect(event.kind).toBe("order");
    expect(event.orderId).toBe("ORD9");
    expect(event.table).toBe("Bar 3");
    expect(event.lines[0]).toMatchObject({ id: "li-1", name: "Burger", quantity: 2, plu: "CAT1", note: "medium rare", modifiers: ["Double", "Cheddar", "2× Bacon"], total: 32 });
    expect(event.lines[1]).toMatchObject({ name: "Fries", modifiers: [], total: 4.5 });
    expect(eventIdOf({ event_id: "e-9" }, {})).toBe("e-9");
  });

  it("reads a Toast-style order split in checks and selections", () => {
    const [event] = readPosPayload({
      eventType: "ORDER_UPDATED",
      details: { order: { guid: "T-55", table: { name: "7" }, numberOfGuests: 3, server: { firstName: "Luca" },
        checks: [{ guid: "C1", selections: [
          { guid: "s1", displayName: "Carbonara", quantity: 1, modifiers: [{ displayName: "No pepper" }], price: 14 },
          { guid: "s2", displayName: "Lasagne", quantity: 1, voided: true, price: 13 }
        ] }] } }
    });
    expect(event.kind).toBe("update");
    expect(event.orderId).toBe("T-55");
    const [noCheckId] = readPosPayload({ eventType: "ORDER_CREATED", details: { order: { guid: "T-56", checks: [{ selections: [{ displayName: "Carbonara", quantity: 1 }] }] } } });
    expect(noCheckId.orderId).toBe("T-56");
    expect(event.lines.map((line) => [line.name, line.modifiers, line.voided ?? false])).toEqual([["Carbonara", ["No pepper"], false], ["Lasagne", [], true]]);
  });

  it("reads a delivery-platform order with sub-items and PLUs", () => {
    const [event] = readPosPayload({
      channelOrderId: "DLV-77", channel: "Deliveroo", tableNumber: "", note: "Citofono rotto",
      items: [{ plu: "P-10", name: "Pizza menu", quantity: 1, price: 1500, subItems: [{ name: "Diavola" }, { name: "Coca-Cola" }] }]
    });
    expect(event.kind).toBe("order");
    expect(event.orderId).toBe("DLV-77");
    expect(event.channel).toBe("Deliveroo");
    expect(event.note).toBe("Citofono rotto");
    expect(event.lines[0]).toMatchObject({ name: "Pizza menu", plu: "P-10", modifiers: ["Diavola", "Coca-Cola"] });
  });

  it("reads courses grouped under their name and lines without ids", () => {
    const [event] = readPosPayload({ type: "ticket.created", id: "T1", courses: [{ name: "Antipasti", items: ["Bruschetta", "Bruschetta"] }, { name: "Secondi", items: [{ name: "Tagliata", qty: 2 }] }] });
    expect(event.lines.map((line) => [line.name, line.course, line.quantity])).toEqual([["Bruschetta", "Antipasti", 1], ["Bruschetta", "Antipasti", 1], ["Tagliata", "Secondi", 2]]);
    expect(new Set(event.lines.map((line) => line.id)).size).toBe(3);
  });

  it("tells the kind of notice from the till's words", () => {
    expect(kindOf("order.updated COMPLETED")).toBe("paid");
    expect(kindOf("order.updated CANCELED")).toBe("void");
    expect(kindOf("payment.updated FAILED")).toBe("unknown");
    expect(kindOf("refund.created")).toBe("refund");
    expect(kindOf("course.fired")).toBe("fire");
    expect(kindOf("ORDER_CREATED")).toBe("order");
    expect(kindOf("check.closed")).toBe("paid");
  });

  it("reads a payment without lines and a course sent away", () => {
    const [paid] = readPosPayload({ type: "payment.updated", event_id: "p1", data: { object: { payment: { id: "PAY1", order_id: "ORD9", status: "COMPLETED", receipt_number: "R7" } } } });
    expect(paid).toMatchObject({ kind: "paid", orderId: "ORD9", receiptId: "R7", lines: [] });
    const [fire] = readPosPayload({ type: "course.fired", order_id: "A-1001", course: "Dolci" });
    expect(fire).toMatchObject({ kind: "fire", orderId: "A-1001", fired: ["Dolci"] });
  });
});

describe("orders on the kitchen screen", () => {
  const first = readPosPayload({ event: "order.created", order: { id: "A1", table: "4", lines: [
    { id: "1", name: "Margherita", quantity: 1, course: "Principali" },
    { id: "2", name: "Fries", quantity: 1, course: "Principali" },
    { id: "3", name: "Tiramisù", quantity: 2, course: "Dolci", held: true }
  ] } })[0];

  it("shows changes: added lines, removed lines struck through, changed lines to make again", () => {
    const created = applyPosEvent(null, first, NOW);
    expect(created.status).toBe("open");
    const pos = created.pos as PosOrder;
    expect(pos.lines[2].held).toBe(true);
    const update = readPosPayload({ event: "order.updated", order: { id: "A1", lines: [
      { id: "1", name: "Margherita", quantity: 2, course: "Principali" },
      { id: "3", name: "Tiramisù", quantity: 2, course: "Dolci", held: true },
      { id: "4", name: "Coke", quantity: 1 }
    ] } })[0];
    const next = applyPosEvent(pos, update, LATER).pos as PosOrder;
    const byId = Object.fromEntries(next.lines.map((line) => [line.id, line]));
    expect(byId["1"]).toMatchObject({ quantity: 2, changedAt: LATER, rev: 1 });
    expect(lineKey(byId["1"])).toBe("1~1");
    expect(byId["2"]).toMatchObject({ voided: true, voidedAt: LATER });
    expect(byId["4"]).toMatchObject({ addedAt: LATER });
    expect(next.changedAt).toBe(LATER);
  });

  it("sends held courses away, voids single lines and cancels whole orders", () => {
    const pos = applyPosEvent(null, first, NOW).pos as PosOrder;
    const fired = applyPosEvent(pos, readPosPayload({ type: "course.fired", order_id: "A1", course: "Dolci" })[0], LATER).pos as PosOrder;
    expect(fired.lines[2].held).toBeUndefined();
    expect(fired.fired).toEqual(["Dolci"]);
    const voided = applyPosEvent(fired, readPosPayload({ type: "item.voided", order_id: "A1", items: [{ name: "Fries" }] })[0], LATER);
    expect(voided.pos?.lines[1].voided).toBe(true);
    expect(voided.status).toBeUndefined();
    const cancelled = applyPosEvent(fired, readPosPayload({ type: "order.cancelled", order_id: "A1" })[0], LATER);
    expect(cancelled.status).toBe("cancelled");
  });

  it("knows when every line is ready, with the ticks kept apart from the till part", () => {
    const pos = applyPosEvent(null, first, NOW).pos as PosOrder;
    const order = toKitchenOrder({ id: "o", status: "open", pos, kitchen: { lines: { "1": { at: NOW, by: "Ana" }, "2": { at: NOW, by: "Ana" } } }, version: 1, updatedAt: NOW });
    expect(order.lines[0].ready?.by).toBe("Ana");
    expect(allReady(order, [])).toBe(false);
    const done = toKitchenOrder({ id: "o", status: "open", pos: { ...pos, lines: pos.lines.map((line) => ({ ...line, held: undefined })) }, kitchen: { lines: { "1": { at: NOW, by: "A" }, "2": { at: NOW, by: "A" }, "3": { at: NOW, by: "A" } } }, version: 1, updatedAt: NOW });
    expect(allReady(done, [])).toBe(true);
  });
});

describe("stations, recipes and sales", () => {
  const recipes = [
    { id: "r1", name: "Margherita", category: "Pizze", archivedBatch: false },
    { id: "r2", name: "Tiramisù", category: "Dolci", archivedBatch: false },
    { id: "r3", name: "Chicken Burger", category: "Burger", archivedBatch: false }
  ] as Recipe[];
  const stations = [
    { id: "oven", name: "Forno", match: ["Pizze"] },
    { id: "pastry", name: "Dolci", match: ["dolci"] },
    { id: "hot", name: "Linea", match: [], fallback: true }
  ];

  it("routes lines by recipe category, till category or course, and the rest to the fallback station", () => {
    expect(stationsOf({ name: "Margherita" }, recipes[0], stations)).toEqual(["oven"]);
    expect(stationsOf({ name: "Panna cotta", course: "Dolci" }, undefined, stations)).toEqual(["pastry"]);
    expect(stationsOf({ name: "Soup" }, undefined, stations)).toEqual(["hot"]);
  });

  it("matches till dishes by hand (PLU first) or by the same name", () => {
    expect(resolveRecipe({ name: "BURGER CHK" }, { "name:burger chk": "r3" }, recipes)).toBe("r3");
    expect(resolveRecipe({ name: "Anything", plu: "55" }, { "plu:55": "r1" }, recipes)).toBe("r1");
    expect(resolveRecipe({ name: "tiramisu" }, {}, recipes)).toBe("r2");
    expect(resolveRecipe({ name: "Coke" }, {}, recipes)).toBeUndefined();
  });

  it("adds up till receipts by week, leaving out what is not food", () => {
    const config = normalizeOrdersConfig({ notFood: ["Drinks"], dishMap: { "name:burger chk": "r3" } });
    const weeks = posSalesWeeks([
      { period: "2026-11-23", name: "BURGER CHK", plu: "", category: "", quantity: 3, revenue: 36, unpriced: 0 },
      { period: "2026-11-23", name: "Chicken Burger", plu: "", category: "", quantity: 1, revenue: 12, unpriced: 0 },
      { period: "2026-11-23", name: "Coke", plu: "", category: "Drinks", quantity: 5, revenue: 15, unpriced: 0 },
      { period: "2026-11-23", name: "Margherita", plu: "", category: "", quantity: 2, revenue: 0, unpriced: 2 }
    ], [{ period: "2026-11-25", name: "BURGER CHK", plu: "", category: "", quantity: 3, revenue: 36, unpriced: 0 }], config, recipes);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].source).toBe("pos");
    expect(weeks[0].lines).toEqual([{ recipeId: "r3", name: "Chicken Burger", quantity: 4, revenue: 48 }, { recipeId: "r1", name: "Margherita", quantity: 2, revenue: null }]);
    expect(weeks[0].days).toEqual([{ date: "2026-11-25", dishes: 3, revenue: 36 }]);
    const merged = mergeSalesWeeks([{ id: "2026-11-23", lines: [], createdAt: "", updatedAt: "" }, { id: "2026-11-16", lines: [], createdAt: "", updatedAt: "" }], weeks);
    expect(merged.map((week) => [week.id, week.source ?? "manual"])).toEqual([["2026-11-16", "manual"], ["2026-11-23", "pos"]]);
  });

  it("records only what was not voided, turning pence into pounds when asked", () => {
    const sale = saleOf("R1", "2026-11-25", [
      { id: "1", name: "Burger", quantity: 2, modifiers: [], total: 2400 },
      { id: "2", name: "Fries", quantity: 1, modifiers: [], voided: true, total: 450 }
    ], true);
    expect(sale.lines).toEqual([{ name: "Burger", quantity: 2, total: 24 }]);
  });
});

describe("signed notices", () => {
  const body = JSON.stringify({ type: "order.created" });

  it("accepts a plain HMAC of the body in hex or base64, and refuses a wrong one", () => {
    const hex = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature("s3cret", body, { "x-signature": hex }, "")).toBe(true);
    expect(verifySignature("s3cret", body, { "x-hub-signature-256": "sha256=" + hex }, "")).toBe(true);
    expect(verifySignature("s3cret", body, { "x-webhook-hmac": createHmac("sha256", "s3cret").update(body).digest("base64") }, "")).toBe(true);
    expect(verifySignature("s3cret", body, { "x-signature": "00" + hex.slice(2) }, "")).toBe(false);
    expect(verifySignature("s3cret", body, {}, "")).toBe(false);
  });

  it("accepts Standard Webhooks and Square signatures", () => {
    const key = Buffer.from("topsecretkey").toString("base64");
    const signature = createHmac("sha256", Buffer.from(key, "base64")).update("msg_1.1700000000." + body).digest("base64");
    expect(verifySignature("whsec_" + key, body, { "webhook-id": "msg_1", "webhook-timestamp": "1700000000", "webhook-signature": "v1," + signature }, "")).toBe(true);
    const url = "https://example.test/api/pos/abc";
    const square = createHmac("sha256", "sq").update(url + body).digest("base64");
    expect(verifySignature("sq", body, { "x-square-hmacsha256-signature": square }, url)).toBe(true);
  });
});
