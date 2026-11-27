import { describe, expect, it } from "vitest";
import { methodSteps, printQuantity, printScale, scaledRow } from "@/lib/recipes/print";
import type { Ingredient } from "@/lib/types";

describe("recipe sheets", () => {
  it("scales the quantities to the portions chosen", () => {
    expect(printScale({ portions: 8 }, 16)).toBe(2);
    expect(printScale({ portions: 8 }, 0)).toBe(1);
    expect(printScale({ portions: 0 }, 3)).toBe(3);
    const row = { type: "Prodotto", name: "Flour", supplier: "", quantity: 250, unit: "g", unitCost: 0.002, allergens: [], kcal: 3 } as Ingredient;
    expect(scaledRow(row, 1.5).quantity).toBe(375);
  });

  it("writes quantities the way a cook reads them", () => {
    expect(printQuantity(1250, "en")).toBe("1,250");
    expect(printQuantity(12.46, "en")).toBe("12.5");
    expect(printQuantity(1.255, "en")).toBe("1.26");
    expect(printQuantity(0.5, "it")).toBe("0,5");
    expect(printQuantity(30, "en")).toBe("30");
  });

  it("numbers the method one step per line, without the numbers already typed", () => {
    expect(methodSteps("1. Squeeze the citrus.\n2) Mix.\n\n- Rest\n• Serve")).toEqual(["Squeeze the citrus.", "Mix.", "Rest", "Serve"]);
    expect(methodSteps("Roast at 170 °C.\n10 minutes, then cool.")).toEqual(["Roast at 170 °C.", "10 minutes, then cool."]);
    expect(methodSteps("3.5 kg potatoes, peeled.\n2.Mix")).toEqual(["3.5 kg potatoes, peeled.", "2.Mix"]);
    expect(methodSteps(undefined)).toEqual([]);
  });
});
