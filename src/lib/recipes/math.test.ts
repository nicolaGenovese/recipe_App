import { describe, expect, it } from "vitest";
import { allergens, margin, portionCost, recipeCostGaps, suggestPrice, totalCost } from "@/lib/recipes/math";
import type { Ingredient, Recipe } from "@/lib/types";

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

import { categoryChips, scopedRecipes } from "@/lib/recipes/filter";
import { ALL_CATEGORIES } from "@/state/view";
import type { Menu } from "@/lib/types";

describe("category chips follow the view", () => {
  const dish = (id: string, category: string, archivedBatch = false) => ({ id, name: id, category, portions: 1, archivedBatch, sellingPrice: 0, ingredients: [] });
  const recipes = [dish("pizza1", "Pizza"), dish("pizza2", "Pizza"), dish("burger", "Burgers"), dish("cake", "Desserts"), dish("sauce", "Bases", true)];
  const menus: Menu[] = [{ id: "m", name: "Pizza Menu", active: true, recipeIds: ["pizza1", "pizza2", "cake"], createdAt: "", updatedAt: "" }];
  const settings = ["Starters", "Pizza", "Burgers", "Desserts", "Bases"];

  it("counts only the open menu's dishes and hides its unused categories", () => {
    const chips = categoryChips(settings, scopedRecipes(recipes, { filter: "menu", menuId: "m" }, menus), false);
    expect(chips).toEqual([{ category: ALL_CATEGORIES, count: 3 }, { category: "Pizza", count: 2 }, { category: "Desserts", count: 1 }]);
  });

  it("keeps every category and counts every recipe under all recipes", () => {
    const chips = categoryChips(settings, scopedRecipes(recipes, { filter: "all", menuId: null }, menus), true);
    expect(chips.map((chip) => chip.category)).toEqual([ALL_CATEGORIES, ...settings]);
    expect(chips[0].count).toBe(5);
    expect(chips.find((chip) => chip.category === "Starters")?.count).toBe(0);
  });

  it("keeps the picked chip visible so it can be cleared", () => {
    const chips = categoryChips(settings, scopedRecipes(recipes, { filter: "menu", menuId: "m" }, menus), false, "Burgers");
    expect(chips.find((chip) => chip.category === "Burgers")).toEqual({ category: "Burgers", count: 0 });
  });
});
