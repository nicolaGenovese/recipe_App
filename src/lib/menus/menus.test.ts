import { describe, expect, it } from "vitest";
import { assignRecipeToMenus, dishesOfMenus, legacyMenus, menuRecipeIds, menuStats } from "@/lib/menus/menus";
import type { Menu, Recipe } from "@/lib/types";

const menu = (id: string, recipeIds: string[], active = true): Menu => ({ id, name: id, active, recipeIds, createdAt: "", updatedAt: "" });
const dish = (id: string, cost: number, price: number): Recipe => ({
  id, name: id, category: "", portions: 1, archivedBatch: false, sellingPrice: price, vat: 0,
  ingredients: [{ type: "Prodotto", name: "x", supplier: "", quantity: 1, unit: "kg", unitCost: cost, allergens: [], kcal: 0 }]
});

describe("menus", () => {
  const menus = [menu("main", ["a", "b"]), menu("pizza", ["b", "c"]), menu("roast", ["d"], false)];

  it("counts only dishes on active menus", () => {
    expect([...menuRecipeIds(menus)].sort()).toEqual(["a", "b", "c"]);
  });

  it("returns only the menus whose dishes change", () => {
    const changed = assignRecipeToMenus(menus, "b", ["main", "roast"], "now");
    expect(changed.map((row) => [row.id, row.recipeIds])).toEqual([["pizza", ["c"]], ["roast", ["d", "b"]]]);
  });

  it("lists shared dishes once and skips deleted recipes", () => {
    const recipes = ["a", "b", "c"].map((id) => dish(id, 1, 4));
    expect(dishesOfMenus(menus, ["main", "pizza"], recipes).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("builds the first menu from the old current-menu flag", () => {
    expect(legacyMenus([{ id: "a", currentMenu: true }, { id: "b" }], "Main menu", "m1", "t")).toEqual([
      { id: "m1", name: "Main menu", description: "", active: true, recipeIds: ["a"], createdAt: "t", updatedAt: "t" }
    ]);
    expect(legacyMenus([{ id: "a" }], "Main menu", "m1")).toEqual([]);
  });

  it("works out food cost over priced dishes", () => {
    const stats = menuStats({ recipeIds: ["a", "b", "z"] }, [dish("a", 3, 10), dish("b", 2, 0)], { recipeMarginOnNet: true });
    expect(stats).toMatchObject({ dishes: 2, unpriced: 1, averagePrice: 10 });
    expect(stats.foodCostPercent).toBeCloseTo(30);
    expect(stats.averageMargin).toBeCloseTo(70);
  });
});
