import { describe, expect, it } from "vitest";
import { dishesUsingBase, generatePrepTasks, leftToPrep, mepLines, mergeGeneratedTasks } from "@/lib/prep/prep";
import type { Ingredient, Recipe } from "@/lib/types";

const row = (name: string, quantity: number, unit: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  type: "Prodotto", name, supplier: "", quantity, unit, unitCost: 0, allergens: [], kcal: 0, ...extra
});
const recipe = (id: string, name: string, portions: number, ingredients: Ingredient[], extra: Partial<Recipe> = {}): Recipe => ({
  id, name, category: "", portions, archivedBatch: false, sellingPrice: 0, ingredients, ...extra
});

const sauce = recipe("sauce", "Tomato sauce", 10, [row("Tomatoes", 2, "kg")], { archivedBatch: true });
const pizza = recipe("pizza", "Margherita", 4, [row("Tomato sauce", 0.4, "kg", { type: "Base / preparazione", stockItemId: "recipe:sauce" }), row("Flour", 1, "kg")],
  { mep: "- Stretch dough\n- Grate cheese" });
const pasta = recipe("pasta", "Spaghetti", 2, [row("tomato sauce", 0.3, "kg", { type: "Base / preparazione" })], { mep: "Grate cheese" });
const all = [sauce, pizza, pasta];

describe("prep list", () => {
  it("merges the same base across dishes and scales by planned portions", () => {
    const tasks = generatePrepTasks([pizza, pasta], all, { pizza: 8, pasta: 2 }, { includeMep: false });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ name: "Tomato sauce", baseRecipeId: "sauce", unit: "kg", recipeIds: ["pizza", "pasta"] });
    expect(tasks[0].quantity).toBeCloseTo(0.4 * 2 + 0.3);
  });

  it("counts one batch when a dish has no plan, and turns MEP lines into shared jobs", () => {
    const tasks = generatePrepTasks([pizza, pasta], all, {}, { includeMep: true });
    expect(tasks.map((task) => task.name)).toEqual(["Tomato sauce", "Stretch dough", "Grate cheese"]);
    expect(tasks[0].quantity).toBeCloseTo(0.7);
    expect(tasks.find((task) => task.name === "Grate cheese")?.recipeIds).toEqual(["pizza", "pasta"]);
  });

  it("keeps hand-made jobs and progress when rebuilding", () => {
    const first = generatePrepTasks([pizza], all, { pizza: 4 }, { includeMep: true });
    const edited = first.map((task) => ({ ...task, done: true, notes: "ok" }));
    const manual = { id: "m", name: "Clean fryer", quantity: 0, onHand: 0, unit: "", recipeIds: [], done: false };
    const rebuilt = mergeGeneratedTasks([...edited, manual], generatePrepTasks([pizza, pasta], all, { pizza: 4, pasta: 2 }, { includeMep: false }));
    expect(rebuilt.map((task) => task.name)).toEqual(["Tomato sauce", "Clean fryer"]);
    expect(rebuilt[0]).toMatchObject({ done: true, notes: "ok", recipeIds: ["pizza", "pasta"] });
    expect(rebuilt[0].quantity).toBeCloseTo(0.7);
  });

  it("finds dishes using a base, strips bullets, and never goes below zero left to prep", () => {
    expect(dishesUsingBase(sauce, all, all).map((dish) => dish.id)).toEqual(["pizza", "pasta"]);
    expect(mepLines("1. Peel\n• Chop\n\n  ")).toEqual(["Peel", "Chop"]);
    expect(leftToPrep({ quantity: 2, onHand: 3 })).toBe(0);
    expect(leftToPrep({ quantity: 2.5, onHand: 1 })).toBe(1.5);
  });
});
