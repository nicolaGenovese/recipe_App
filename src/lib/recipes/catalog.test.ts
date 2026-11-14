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

import { toRecipeUnits } from "@/lib/recipes/catalog";
import { changeUnit, ingredientDraft, matchIngredient } from "@/lib/recipes/form";
import { ingredientFromSource } from "@/lib/stock/sources";

describe("grams and millilitres in recipes", () => {
  it("moves kg and l rows to g and ml at the same cost", () => {
    const moved = toRecipeUnits(row({ unit: "kg", quantity: 0.09, unitCost: 8, kcal: 2800 }));
    expect(moved).toMatchObject({ unit: "g", quantity: 90, unitCost: 0.008, kcal: 2.8 });
    expect(toRecipeUnits(row({ unit: "l", quantity: 0.006 })).quantity).toBe(6);
    const pieces = row({ unit: "pz", quantity: 1 });
    expect(toRecipeUnits(pieces)).toBe(pieces);
  });

  it("links a kg product as grams and converts when the unit changes", () => {
    const linked = matchIngredient(ingredientDraft({ name: "Butter" }), [{ ...butter, batch: false }]);
    expect(linked).toMatchObject({ unit: "g", unitCost: "0.004", stockItemId: "p1" });
    const typed = { ...ingredientDraft({ name: "Flour", unitCost: 1.2 }), unit: "kg", quantity: "0.5" };
    expect(changeUnit(typed, "g")).toMatchObject({ unit: "g", quantity: "500", unitCost: "0.0012" });
    expect(changeUnit(typed, "pz")).toMatchObject({ unit: "pz", quantity: "0.5" });
  });

  it("builds rows from the stock picker in grams", () => {
    expect(ingredientFromSource({ ...butter, batch: false }, 0.25)).toMatchObject({ unit: "g", quantity: 250, unitCost: 0.004 });
  });
});

import { isMissingFromStock, missingIngredients } from "@/lib/recipes/catalog";
import { productFormFromRow, productFromForm } from "@/lib/stock/productForm";

describe("ingredients not in stock", () => {
  it("lists product rows without a link once per name, with their recipes", () => {
    const a: Recipe = { id: "a", name: "Pizza", category: "", portions: 1, archivedBatch: false, sellingPrice: 0, ingredients: [
      row({ name: "Basil" }), row({ name: "Water", type: "Esterno" }), row({ name: "Butter", stockItemId: "p1" }), row({ name: "" })
    ] };
    const b: Recipe = { ...a, id: "b", name: "Pasta", ingredients: [row({ name: " basil " }), row({ name: "Basil" })] };
    const missing = missingIngredients([a, b], [butter]);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ name: "Basil", recipes: [{ id: "a", name: "Pizza" }, { id: "b", name: "Pasta" }] });
    expect(isMissingFromStock(row({ name: "Thyme", type: "Base / preparazione" }), [butter], [])).toBe(false);
  });

  it("fills a product sheet from a row in grams as a product bought by the kilo", () => {
    const form = productFormFromRow({ name: "Basil ", supplier: "Farm", unit: "g", unitCost: 0.02, allergens: ["Sedano"], kcal: 0.23 });
    expect(form).toMatchObject({ name: "Basil", supplier: "Farm", measurement: "Kilo", unitOfSale: "kg", price: "20", recipeContent: "1", recipeUnit: "kg", kcal: "230", allergens: "Sedano" });
    const product = productFromForm(form, "new");
    expect(resolveIngredient(row({ stockItemId: "new", unit: "g" }), [product], []).unitCost).toBe(0.02);
    expect(productFormFromRow({ name: "Egg", supplier: "", unit: "pz", unitCost: 0.3, allergens: [], kcal: 70 })).toMatchObject({ measurement: "Each", recipeUnit: "pz", price: "0.3" });
  });
});
