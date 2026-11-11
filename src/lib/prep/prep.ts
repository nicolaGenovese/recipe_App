import { newId, num } from "@/lib/num";
import { portionsOf } from "@/lib/recipes/math";
import type { Ingredient, PrepList, PrepTask, Recipe } from "@/lib/types";

const BASE_TYPE = "Base / preparazione";
const RECIPE_LINK = "recipe:";

const key = (value: string) => value.trim().toLocaleLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** The base recipe an ingredient row points to: by its link first, then by name. */
export function baseRecipeOf(row: Pick<Ingredient, "name" | "stockItemId">, recipes: Recipe[]): Recipe | undefined {
  if (row.stockItemId?.startsWith(RECIPE_LINK)) {
    const linked = recipes.find((recipe) => recipe.id === row.stockItemId!.slice(RECIPE_LINK.length));
    if (linked) return linked;
  }
  return recipes.find((recipe) => recipe.archivedBatch && key(recipe.name) === key(row.name || ""));
}

/** Rows that are prepared in house: base ingredients and anything linked to a base recipe. */
export function isPrepRow(row: Pick<Ingredient, "type" | "stockItemId">): boolean {
  return row.type === BASE_TYPE || Boolean(row.stockItemId?.startsWith(RECIPE_LINK));
}

/** Mise en place notes, one job per line. Bullets and numbering are dropped. */
export function mepLines(text: string | undefined): string[] {
  return (text || "").split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}

/** Dishes among `dishes` that use the base recipe as an ingredient. */
export function dishesUsingBase(base: Recipe, dishes: Recipe[], recipes: Recipe[]): Recipe[] {
  return dishes.filter((dish) => dish.id !== base.id && (dish.ingredients || []).some((row) => baseRecipeOf(row, recipes)?.id === base.id));
}

export interface GenerateOptions {
  /** Turn each line of the dishes' MEP notes into a job. */
  includeMep: boolean;
}

/**
 * Jobs needed to serve the dishes. The same base used by several dishes becomes one job that lists
 * all of them, with the amounts added up. Amounts scale with the planned portions of each dish;
 * a dish without a plan counts as one batch of its recipe.
 */
export function generatePrepTasks(dishes: Recipe[], recipes: Recipe[], portions: Record<string, number>, options: GenerateOptions): PrepTask[] {
  const tasks = new Map<string, PrepTask>();
  const add = (auto: string, make: () => Omit<PrepTask, "id" | "recipeIds" | "auto">, dishId: string, amount: number) => {
    const task = tasks.get(auto) ?? { id: newId(), auto, recipeIds: [], ...make() };
    task.quantity = round3(task.quantity + amount);
    if (!task.recipeIds.includes(dishId)) task.recipeIds.push(dishId);
    tasks.set(auto, task);
  };

  for (const dish of dishes) {
    const planned = portions[dish.id];
    const factor = (planned === undefined ? portionsOf(dish) : Math.max(0, num(planned))) / portionsOf(dish);
    for (const row of dish.ingredients || []) {
      if (!isPrepRow(row)) continue;
      const base = baseRecipeOf(row, recipes);
      const unit = (row.unit || "").trim();
      add("base:" + (base ? base.id : key(row.name || "")) + "|" + key(unit), () => ({
        name: base?.name || row.name, quantity: 0, onHand: 0, unit, baseRecipeId: base?.id, notes: "", done: false
      }), dish.id, num(row.quantity) * factor);
    }
    if (options.includeMep) {
      for (const line of mepLines(dish.mep)) {
        add("mep:" + key(line), () => ({ name: line, quantity: 0, onHand: 0, unit: "", notes: "", done: false }), dish.id, 0);
      }
    }
  }
  return Array.from(tasks.values());
}

/**
 * Rebuilds the jobs that came from the dishes and keeps everything typed by hand.
 * A rebuilt job keeps its name, progress and notes; jobs the dishes no longer need are dropped.
 */
export function mergeGeneratedTasks(existing: PrepTask[], generated: PrepTask[]): PrepTask[] {
  const fresh = new Map(generated.map((task) => [task.auto as string, task]));
  const kept = existing.flatMap((task) => {
    if (!task.auto) return [task];
    const next = fresh.get(task.auto);
    if (!next) return [];
    fresh.delete(task.auto);
    return [{ ...task, quantity: next.quantity, unit: next.unit, recipeIds: next.recipeIds, baseRecipeId: next.baseRecipeId }];
  });
  return kept.concat(Array.from(fresh.values()));
}

/** What is still to prepare. */
export function leftToPrep(task: Pick<PrepTask, "quantity" | "onHand">): number {
  return round3(Math.max(0, num(task.quantity) - num(task.onHand)));
}

export function prepProgress(list: Pick<PrepList, "tasks">): { done: number; total: number } {
  return { done: list.tasks.filter((task) => task.done).length, total: list.tasks.length };
}

/** Lists sorted for display: newest service date first. */
export function sortPrepLists(lists: PrepList[]): PrepList[] {
  return [...lists].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export function blankTask(): PrepTask {
  return { id: newId(), name: "", quantity: 0, onHand: 0, unit: "", recipeIds: [], notes: "", done: false };
}
