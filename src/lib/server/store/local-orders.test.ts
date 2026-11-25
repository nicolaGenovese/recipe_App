import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { localOrders, localSalesRows } from "@/lib/server/store/local-orders";

const dir = await mkdtemp(path.join(tmpdir(), "rs-orders-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("till orders in the local file", () => {
  const orders = localOrders(path.join(dir, "recipes.json"));
  const pos = { externalId: "A1", allergies: [], receivedAt: "2026-11-25T19:00:00.000Z", fired: [], lines: [{ id: "1", name: "Margherita", quantity: 1, modifiers: [] }] };

  it("writes the till part once per version and keeps the kitchen ticks apart", async () => {
    expect(await orders.putPos("o1", pos, "open", 0)).toBe(true);
    expect(await orders.putPos("o1", pos, "open", 0)).toBe(false);
    expect(await orders.putPos("o1", { ...pos, table: "4" }, undefined, 1)).toBe(true);
    expect(await orders.putPos("o1", pos, undefined, 1)).toBe(false);
    const ticked = await orders.kitchen("o1", { ready: { "1": { at: "t", by: "Ana" } }, claim: { by: "Ana", at: "t" } });
    expect(ticked?.kitchen).toMatchObject({ claimedBy: "Ana", lines: { "1": { by: "Ana" } } });
    expect(ticked?.pos.table).toBe("4");
    const bumped = await orders.kitchen("o1", { status: "done", done: { at: "t", by: "Ana" }, unready: ["1"] });
    expect(bumped?.status).toBe("done");
    expect(bumped?.kitchen.lines).toEqual({});
    expect((await orders.list()).orders.map((order) => order.id)).toEqual(["o1"]);
  });

  it("logs each notice once and adds up receipts by week and day", async () => {
    const first = await orders.logEvent("evt-1", "{}");
    expect(first).not.toBeNull();
    expect(await orders.logEvent("evt-1", "{}")).toBeNull();
    await orders.dropEvent(first as string);
    expect(await orders.logEvent("evt-1", "{}")).not.toBeNull();
    await orders.saveSale({ receiptId: "R1", day: "2026-11-25", lines: [{ name: "Margherita", quantity: 2, total: 19 }] });
    await orders.saveSale({ receiptId: "R1", day: "2026-11-25", lines: [{ name: "Margherita", quantity: 2, total: 19 }] });
    await orders.saveSale({ receiptId: "refund:1", day: "2026-11-26", lines: [{ name: "Margherita", quantity: -1, total: -9.5 }] });
    const { sales } = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(dir, "recipes.orders.json"), "utf8"));
    expect(localSalesRows(sales, "week")).toEqual([{ period: "2026-11-23", name: "Margherita", plu: "", category: "", quantity: 1, revenue: 9.5, unpriced: 0 }]);
    expect(localSalesRows(sales, "day").map((row) => [row.period, row.quantity])).toEqual([["2026-11-25", 2], ["2026-11-26", -1]]);
  });
});
