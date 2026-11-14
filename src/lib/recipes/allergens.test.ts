import { describe, expect, it } from "vitest";
import { allergenSources, allergenStatus, matrixColumns, menuAllergenSummary, nextAllergenCheck } from "@/lib/recipes/allergens";
import type { Ingredient, Recipe } from "@/lib/types";

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
