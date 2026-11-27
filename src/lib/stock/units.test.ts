import { describe, expect, it } from "vitest";
import { makeTranslate } from "@/lib/i18n";
import { convertQuantity, unitFactor, unitText } from "@/lib/stock/units";

describe("units", () => {
  it("shows the Italian unit words in the reader's language and leaves the others as they are", () => {
    const en = makeTranslate("en");
    const it = makeTranslate("it");
    expect(["pz", "porz", "mazzo", "confezione", "g", "kg", "ml", "tsp", ""].map((unit) => unitText(unit, en))).toEqual(["pc", "ptn", "bunch", "pack", "g", "kg", "ml", "tsp", ""]);
    expect(unitText("pz", it)).toBe("pz");
    expect(unitText("portion", it)).toBe("porz");
  });

  it("understands the English abbreviations typed by hand", () => {
    expect(unitFactor("ptn", "porz")).toBe(1);
    expect(unitFactor("pcs", "pz")).toBe(1);
    expect(unitFactor("bunch", "mazzo")).toBe(1);
    expect(unitFactor("pack", "confezione")).toBe(1);
    expect(convertQuantity(0.25, "kg", "g")).toBe(250);
  });
});
