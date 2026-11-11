import { describe, expect, it } from "vitest";
import { currentQuantity, inventoryRow, maxBatches, nextStockCode } from "@/lib/stock/inventory";
import { ingredientUnitCost, unitFactor } from "@/lib/stock/units";
import type { StockDelivery, StockItem, StockReport } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "a", code: "ING01", name: "Burro", supplier: "Latticini", group: "", measurement: "Kilo", unitOfSale: "kg", unitsPerPack: 1,
  price: 8, initialStock: 4, recipeContent: 1, recipeUnit: "kg", allergens: [], kcal: 0, parLevel: 0, ...over
});
const delivery = (date: string, quantity: number, createdAt = date + "T12:00:00Z"): StockDelivery => ({
  id: "d" + date, invoiceNumber: "F", date, supplier: "", invoiceAmount: null, createdAt, lines: [{ itemId: "a", name: "Burro", quantity, price: 8 }]
});
const submitted: StockReport = {
  id: "r1", number: 1, status: "submitted", dateFrom: "2026-11-01", dateTo: "2026-11-07", createdAt: "", submittedAt: "2026-11-08T09:00:00Z",
  lines: [{ itemId: "a", name: "Burro", supplier: "", group: "", measurement: "Kilo", unitOfSale: "kg", unitsPerPack: 1, price: 8, batch: false, opening: 0, invoiceQty: 0, delivered: 0, closing: 6 }],
  transfer: 0, netSales: 0, invoicesTotal: null, openingTotal: null
};

describe("currentQuantity", () => {
  it("starts from the initial stock and adds deliveries", () => {
    expect(currentQuantity(item(), [], [delivery("2026-11-02", 3)])).toBe(7);
  });

  it("starts from the last submitted closing and ignores deliveries it already covers", () => {
    expect(currentQuantity(item(), [submitted], [delivery("2026-11-02", 3), delivery("2026-11-09", 1)])).toBe(7);
  });

  it("uses a count typed after the last report and only adds later deliveries", () => {
    const counted = item({ stockCount: { quantity: 2, date: "2026-11-10", at: "2026-11-10T10:00:00Z" } });
    const deliveries = [delivery("2026-11-09", 5), delivery("2026-11-10", 1, "2026-11-10T09:00:00Z"), delivery("2026-11-10", 4, "2026-11-10T11:00:00Z")];
    expect(currentQuantity(counted, [submitted], deliveries)).toBe(6);
  });

  it("drops a count once a report is submitted after it", () => {
    const counted = item({ stockCount: { quantity: 2, date: "2026-11-05", at: "2026-11-05T10:00:00Z" } });
    expect(currentQuantity(counted, [submitted], [])).toBe(6);
  });

  it("converts packs received into single pieces", () => {
    expect(currentQuantity(item({ measurement: "Each", unitsPerPack: 12, initialStock: 0 }), [], [delivery("2026-11-02", 2)])).toBe(24);
  });
});

describe("inventoryRow", () => {
  it("flags products under their par level", () => {
    const row = inventoryRow(item({ parLevel: 10 }), [], []);
    expect(row.reorder).toBe(6);
    expect(row.status).toBe("reorder");
    expect(row.value).toBe(32);
    expect(inventoryRow(item({ parLevel: 0 }), [], []).status).toBe("none");
  });

  it("numbers new codes after the highest one", () => {
    expect(nextStockCode([{ code: "ING30" }, { code: "ING121" }, {}])).toBe("ING122");
    expect(nextStockCode([])).toBe("ING01");
  });
});

describe("units and costs", () => {
  it("converts weights and volumes on one scale", () => {
    expect(unitFactor("g", "kg")).toBe(0.001);
    expect(unitFactor("ml", "l")).toBe(0.001);
    expect(unitFactor("tbsp", "g")).toBe(15);
    expect(unitFactor("pinte", "pints")).toBe(1);
    expect(unitFactor("pz", "kg")).toBeNull();
  });

  it("prices one recipe unit from the product price", () => {
    expect(ingredientUnitCost({ price: 4, recipeContent: 1, recipeUnit: "kg" }, "g")).toBe(0.004);
    expect(ingredientUnitCost({ price: 0, recipeContent: 1, recipeUnit: "kg" }, "g")).toBeNull();
    expect(ingredientUnitCost({ price: 4, recipeContent: 1, recipeUnit: "kg" }, "pz")).toBeNull();
  });

  it("counts how many batches the stock allows", () => {
    expect(maxBatches([{ quantity: 2, available: 7 }, { quantity: 1, available: 10 }])).toBe(3);
    expect(maxBatches([])).toBe(0);
  });
});
