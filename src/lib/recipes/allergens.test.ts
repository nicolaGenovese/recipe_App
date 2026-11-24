import { describe, expect, it } from "vitest";
import { allergenSources, allergenStatus, matrixColumns, menuAllergenSummary, nextAllergenCheck } from "@/lib/recipes/allergens";
import { resolveRecipe } from "@/lib/recipes/catalog";
import { productForm, productFromForm } from "@/lib/stock/productForm";
import type { Ingredient, Recipe, StockItem } from "@/lib/types";

const row = (name: string, allergens: string[], extra: Partial<Ingredient> = {}): Ingredient =>
  ({ type: "Esterno", name, supplier: "", quantity: 1, unit: "g", unitCost: 0, allergens, kcal: 0, ...extra });
const dish = (extra: Partial<Recipe> = {}): Recipe => ({
  id: "d", name: "Margherita", category: "Pizza", portions: 1, archivedBatch: false, sellingPrice: 10,
  ingredients: [row("Dough", ["Glutine"]), row("Mozzarella", ["Latte"]), row("Butter", ["Latte"])], ...extra
});

describe("dish allergens", () => {
  it("lists allergens with the ingredients that bring them", () => {
    expect(allergenSources(dish())).toEqual([{ allergen: "Glutine", ingredients: ["Dough"] }, { allergen: "Latte", ingredients: ["Mozzarella", "Butter"] }]);
  });

  it("is unconfirmed until checked, and empty without ingredients", () => {
    expect(allergenStatus(dish()).state).toBe("unconfirmed");
    expect(allergenStatus(dish({ ingredients: [] })).state).toBe("empty");
  });

  it("keeps traces apart and drops a trace the dish already contains", () => {
    const status = allergenStatus(dish({ mayContain: ["Sesamo", "Latte"] }));
    expect(status.mayContain).toEqual(["Sesamo"]);
  });

  it("stays confirmed until the allergens change, then says what changed", () => {
    const base = dish({ mayContain: ["Sesamo"] });
    const check = nextAllergenCheck(base, { confirmed: true, touched: true, by: " Chef " }, "2026-11-14T10:00:00Z")!;
    expect(check).toEqual({ at: "2026-11-14T10:00:00Z", by: "Chef", contains: ["Glutine", "Latte"], mayContain: ["Sesamo"] });
    expect(allergenStatus({ ...base, allergenCheck: check }).state).toBe("ok");
    const changed = allergenStatus({ ...base, allergenCheck: check, ingredients: [...base.ingredients, row("Egg wash", ["Uova"])], mayContain: [] });
    expect(changed).toMatchObject({ state: "changed", added: ["Uova"], removed: ["Sesamo"] });
  });

  it("keeps the old confirmation when the box was not ticked again, and removes it when unticked", () => {
    const old = { at: "2026-01-01", by: "", contains: ["Glutine"], mayContain: [] };
    expect(nextAllergenCheck(dish({ allergenCheck: old }), { confirmed: true, touched: false, by: "" })).toBe(old);
    expect(nextAllergenCheck(dish({ allergenCheck: old }), { confirmed: false, touched: true, by: "" })).toBeUndefined();
  });

  it("flags hand-typed product rows and summarises a menu", () => {
    const typed = dish({ ingredients: [row("Basil", [], { type: "Prodotto" })] });
    expect(allergenStatus(typed).notInStock).toEqual(["Basil"]);
    const ok = dish({ id: "ok" });
    ok.allergenCheck = nextAllergenCheck(ok, { confirmed: true, touched: true, by: "" });
    expect(menuAllergenSummary([ok, dish({ id: "no", name: "Marinara" })])).toMatchObject({ dishes: 2, ok: 1, toCheck: [{ name: "Marinara" }] });
  });

  it("puts the kitchen list first in the matrix, then other labels in use", () => {
    expect(matrixColumns(["Glutine", "Uova"], [dish({ mayContain: ["Nichel"] })])).toEqual(["Glutine", "Uova", "Latte", "Nichel"]);
  });

});

describe("allergens tied to the products", () => {
  const product = (id: string, name: string, extra: Partial<StockItem> = {}): StockItem =>
    ({ id, name, supplier: "", group: "", measurement: "Kilo", unitOfSale: "kg", unitsPerPack: 1, price: 1, initialStock: 0, recipeContent: 1, recipeUnit: "kg", allergens: [], kcal: 0, ...extra });
  const linked = (id: string): Ingredient => ({ type: "Prodotto", name: "", supplier: "", quantity: 100, unit: "g", unitCost: 0, allergens: [], kcal: 0, stockItemId: id });
  const flour = product("flour", "Flour", { allergens: ["Glutine"], mayContain: ["Sesamo"] });
  const cheese = product("cheese", "Cheese", { allergens: ["Latte"] });

  it("copies traces from the label, and leaves rows without traces as they were", () => {
    const recipe = resolveRecipe(dish({ ingredients: [linked("flour"), linked("cheese")] }), [flour, cheese], []);
    expect(recipe.ingredients[0].mayContain).toEqual(["Sesamo"]);
    expect("mayContain" in recipe.ingredients[1]).toBe(false);
    const status = allergenStatus(recipe, [flour, cheese], []);
    expect(status.contains).toEqual(["Glutine", "Latte"]);
    expect(status.inherited).toEqual(["Sesamo"]);
    expect(allergenStatus({ ...recipe, mayContain: ["Arachidi"] }, [flour, cheese], []).mayContain).toEqual(["Sesamo", "Arachidi"]);
  });

  it("passes the traces of a base recipe on to the dish", () => {
    const base: Recipe = { id: "b", name: "Dough", category: "", portions: 1, archivedBatch: true, sellingPrice: 0, ingredients: [{ ...linked("flour"), allergens: ["Glutine"], mayContain: ["Sesamo"] }], mayContain: ["Soia"] };
    const recipe = resolveRecipe(dish({ ingredients: [{ ...linked("recipe:b"), unit: "porz" }] }), [flour], [base]);
    expect(recipe.ingredients[0].allergens).toEqual(["Glutine"]);
    expect(recipe.ingredients[0].mayContain).toEqual(["Sesamo", "Soia"]);
  });

  it("cannot be confirmed with hand-written ingredients or products still to check", () => {
    const typed = dish({ ingredients: [{ ...row("Pesto", ["Frutta a guscio"]), type: "Prodotto" }] });
    expect(allergenStatus(typed, [], []).state).toBe("unverified");
    expect(allergenStatus(typed, [], []).notInStock).toEqual(["Pesto"]);
    const fresh = product("new", "New sauce", { allergensChecked: false });
    const usingFresh = resolveRecipe(dish({ ingredients: [linked("new")] }), [fresh], []);
    expect(allergenStatus(usingFresh, [fresh], []).toFill).toEqual(["New sauce"]);
    expect(nextAllergenCheck(usingFresh, { confirmed: true, touched: true, by: "Chef" }, "2026-11-24", [fresh], [])).toBeUndefined();
    const checked = { ...fresh, allergensChecked: true };
    expect(nextAllergenCheck(usingFresh, { confirmed: true, touched: true, by: "Chef" }, "2026-11-24", [checked], [])?.by).toBe("Chef");
  });

  it("asks for a new check when a product's label changes after the confirmation", () => {
    const recipe = resolveRecipe(dish({ ingredients: [linked("cheese")] }), [cheese], []);
    const check = nextAllergenCheck(recipe, { confirmed: true, touched: true, by: "Chef" }, "2026-11-24", [cheese], [])!;
    const relabelled = { ...cheese, mayContain: ["Frutta a guscio"] };
    const status = allergenStatus({ ...resolveRecipe(recipe, [relabelled], []), allergenCheck: check }, [relabelled], []);
    expect(status.state).toBe("changed");
    expect(status.added).toEqual(["Frutta a guscio"]);
  });

  it("starts new products unchecked and keeps saved ones as they were", () => {
    expect(productFromForm(productForm({ name: "New" }), "x").allergensChecked).toBe(false);
    expect(productFromForm(productForm({ id: "old", name: "Old" }), "old").allergensChecked).toBe(true);
    expect(productFromForm(productForm({ id: "old", name: "Old", allergensChecked: false }), "old").allergensChecked).toBe(false);
  });
});
