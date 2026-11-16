import { describe, expect, it } from "vitest";
import { invoiceKey, matchLine, matchSupplier, nameSimilarity, withInvoiceName } from "@/lib/invoices/match";
import { normalizeScan, type ScannedLine } from "@/lib/invoices/scan";
import type { StockItem } from "@/lib/types";

const item = (id: string, name: string, supplier: string, price: number, invoiceNames?: string[]): StockItem => ({
  id, name, supplier, group: "", measurement: "Pack", unitOfSale: "", unitsPerPack: 1, price, initialStock: 0, recipeContent: 1, recipeUnit: "kg", allergens: [], kcal: 0, invoiceNames
});
const line = (description: string, unitPrice = 10): ScannedLine => ({ description, code: "", quantity: 1, unitPrice, lineTotal: null });

const items = [
  item("ched", "Cheddar Mature", "Chapple & Jenkins", 30),
  item("cream", "Double Cream", "Chapple & Jenkins", 7.5),
  item("cream2", "Double Cream", "Other Dairy", 9),
  item("mozz", "Mozzarella", "Chapple & Jenkins", 20, ["fior di latte 1kg block"])
];

describe("reading invoices", () => {
  it("cleans the model answer", () => {
    expect(normalizeScan({
      supplier: " Heanens ", invoiceNumber: 4521, date: "03/11/26", netTotal: "£1,204.50",
      lines: [{ description: "Beef  Burger 7oz", quantity: "2", lineTotal: 25 }, { description: "", quantity: 1 }, { description: "Delivery", quantity: 0 }]
    })).toEqual({
      supplier: "Heanens", invoiceNumber: "4521", date: "2026-11-03", netTotal: 1204.5,
      lines: [{ description: "Beef Burger 7oz", code: "", quantity: 2, unitPrice: 12.5, lineTotal: 25 }]
    });
    expect(normalizeScan("nonsense")).toEqual({ supplier: "", invoiceNumber: "", date: "", netTotal: null, lines: [] });
    expect(normalizeScan({ lines: [{ description: "x", quantity: 1, unitPrice: "12,40" }] }).lines[0].unitPrice).toBe(12.4);
  });

  it("scores names with invoice abbreviations and sizes", () => {
    expect(nameSimilarity("CHEDDAR MATURE COLOURED 5KG", "Cheddar Mature")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("Truffle oil 250ml", "Cheddar Mature")).toBe(0);
  });

  it("matches lines to products, preferring the supplier and remembered texts", () => {
    expect(matchLine(line("CHEDDAR MATURE COLOURED 5KG", 31), "Chapple & Jenkins", items)).toMatchObject({ status: "sure", item: { id: "ched" }, priceChanged: false });
    expect(matchLine(line("Double Cream 2L"), "Chapple & Jenkins", items).item?.id).toBe("cream");
    expect(matchLine(line("Double Cream 2L"), "Other Dairy", items).item?.id).toBe("cream2");
    expect(matchLine(line("FIOR DI LATTE 1KG BLOCK"), "Chapple & Jenkins", items)).toMatchObject({ status: "sure", item: { id: "mozz" } });
    expect(matchLine(line("Truffle oil 250ml"), "Chapple & Jenkins", items)).toMatchObject({ status: "new", item: null });
    expect(matchLine(line("Cheddar Mature", 60), "", items).priceChanged).toBe(true);
  });

  it("spells the supplier as the kitchen does and remembers new texts once", () => {
    expect(matchSupplier("CHAPPLE AND JENKINS LTD", ["Chapple & Jenkins", "Heanens"])).toBe("Chapple & Jenkins");
    expect(matchSupplier("New Farm Co", ["Heanens"])).toBe("New Farm Co");
    expect(withInvoiceName(items[0], "CHED MAT 5KG")).toEqual(["ched mat 5kg"]);
    expect(withInvoiceName(items[3], "Fior di Latte 1KG block")).toBeNull();
    expect(withInvoiceName(items[0], "cheddar mature")).toBeNull();
    expect(invoiceKey("Cheddar, Mature (5kg)")).toBe("cheddar mature 5kg");
  });
});
