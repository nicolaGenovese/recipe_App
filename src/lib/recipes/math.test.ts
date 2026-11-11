import { describe, expect, it } from "vitest";
import { allergens, margin, portionCost, recipeCostGaps, suggestPrice, totalCost } from "@/lib/recipes/math";
import { recipesWithStaleCosts, withStockCost } from "@/lib/stock/sources";
import type { Ingredient, Recipe, StockItem } from "@/lib/types";

const row = (over: Partial<Ingredient> = {}): Ingredient => ({ type: "Prodotto", name: "Burro", supplier: "", quantity: 0.5, unit: "kg", unitCost: 8, allergens: ["Latte"], kcal: 0, ...over });
const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "r", name: "Salsa", category: "", portions: 4, currentMenu: false, archivedBatch: false, sellingPrice: 11, vat: 10, marginTarget: 70,
  ingredients: [row(), row({ name: "Farina", quantity: 1, unitCost: 2, allergens: ["Glutine", "Latte"] })], ...over
});

describe("recipe costs", () => {
  it("adds up the ingredient lines and splits them per portion", () => {
    expect(totalCost(recipe())).toBe(6);
    expect(portionCost(recipe())).toBe(1.5);
    expect(allergens(recipe())).toEqual(["Latte", "Glutine"]);
  });

  it("measures margin on the net price or on the price as entered", () => {
    expect(margin(recipe(), { recipeMarginOnNet: true })).toBeCloseTo(85);
    expect(margin(recipe(), { recipeMarginOnNet: false })).toBeCloseTo(86.36, 1);
    expect(suggestPrice(recipe(), { recipeMarginOnNet: true })).toBeCloseTo(5.5);
    expect(suggestPrice(recipe(), { recipeMarginOnNet: false })).toBeCloseTo(5);
  });

  it("lists lines without a cost, except water", () => {
    const gaps = recipeCostGaps(recipe({ ingredients: [row({ unitCost: 0 }), row({ name: "Acqua", unitCost: 0 })] }));
    expect(gaps.map((gap) => gap.name)).toEqual(["Burro"]);
  });
});

describe("costs linked to stock", () => {
  const butter = { id: "s1", price: 4, recipeContent: 1, recipeUnit: "kg" } as StockItem;

  it("follows the product price and keeps manual costs that cannot convert", () => {
    expect(withStockCost(row({ stockItemId: "s1", unit: "g" }), [butter]).unitCost).toBe(0.004);
    const manual = row({ stockItemId: "s1", unit: "pz", unitCost: 1.2 });
    expect(withStockCost(manual, [butter])).toBe(manual);
  });

  it("finds only the recipes whose costs moved", () => {
    const linked = recipe({ ingredients: [row({ stockItemId: "s1", unit: "kg", unitCost: 4 })] });
    expect(recipesWithStaleCosts([linked], [butter])).toEqual([]);
    expect(recipesWithStaleCosts([linked], [{ ...butter, price: 5 }])[0].ingredients[0].unitCost).toBe(5);
  });
});
