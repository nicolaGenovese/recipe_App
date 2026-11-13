import { describe, expect, it } from "vitest";
import { linkByName, recipesOutOfSync, recipesUsing, resolveIngredient } from "@/lib/recipes/catalog";
import type { Ingredient, Recipe, StockItem } from "@/lib/types";

const butter = {
  id: "p1", name: "Butter", supplier: "Dairy Co", group: "", measurement: "Pack", unitOfSale: "block", unitsPerPack: 1, price: 4, initialStock: 0,
  recipeContent: 1, recipeUnit: "kg", allergens: ["Latte"], kcal: 7170
} as StockItem;
const row = (extra: Partial<Ingredient> = {}): Ingredient => ({ type: "Prodotto", name: "old name", supplier: "", quantity: 100, unit: "g", unitCost: 0, allergens: [], kcal: 0, ...extra });
const sauce: Recipe = { id: "sauce", name: "Béchamel", category: "", portions: 10, archivedBatch: true, sellingPrice: 0, ingredients: [row({ stockItemId: "p1", unit: "kg", quantity: 1, unitCost: 4, allergens: ["Latte"] })] };

describe("ingredient catalogue", () => {
  it("takes name, supplier, allergens, cost and kcal from the product in the row's unit", () => {
    const resolved = resolveIngredient(row({ stockItemId: "p1" }), [butter], []);
    expect(resolved).toMatchObject({ name: "Butter", supplier: "Dairy Co", allergens: ["Latte"], unitCost: 0.004, kcal: 7.17 });
  });

  it("keeps the row's own cost when the units cannot convert", () => {
    expect(resolveIngredient(row({ stockItemId: "p1", unit: "pz", unitCost: 0.5 }), [butter], []).unitCost).toBe(0.5);
  });

  it("takes cost and allergens per portion from a base recipe", () => {
    const resolved = resolveIngredient(row({ stockItemId: "recipe:sauce", unit: "porz" }), [butter], [sauce]);
    expect(resolved).toMatchObject({ type: "Base / preparazione", name: "Béchamel", allergens: ["Latte"], unitCost: 0.4 });
  });

  it("leaves free rows alone and links old copies by name", () => {
    const water = row({ type: "Esterno", name: "Water", unitCost: 0 });
    expect(resolveIngredient(water, [butter], [])).toBe(water);
    expect(linkByName(row({ name: " butter " }), [butter]).stockItemId).toBe("p1");
    expect(linkByName(row({ name: "Butter", type: "Esterno" }), [butter]).stockItemId).toBeUndefined();
  });

  it("finds recipes that drifted from the catalogue and the recipes using a product", () => {
    const dish: Recipe = { id: "d", name: "Dish", category: "", portions: 1, archivedBatch: false, sellingPrice: 10, ingredients: [row({ stockItemId: "p1" })] };
    const synced = recipesOutOfSync([dish], [butter]);
    expect(synced).toHaveLength(1);
    expect(synced[0].ingredients[0].allergens).toEqual(["Latte"]);
    expect(recipesOutOfSync(synced, [butter])).toEqual([]);
    expect(recipesUsing("p1", [dish, sauce]).map((recipe) => recipe.id)).toEqual(["d", "sauce"]);
  });
});
