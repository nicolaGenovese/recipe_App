import { isMissingFromStock } from "@/lib/recipes/catalog";
import type { AllergenCheck, Recipe, StockItem } from "@/lib/types";

// Allergens of a dish come from its ingredients (products and base recipes carry their own).
// "May contain" (traces, shared fryer...) is set on the dish. The kitchen confirms the result:
// the confirmation keeps a copy of what was confirmed, so any later change shows up as
// "to check again" instead of silently passing.

export type AllergenState = "ok" | "changed" | "unconfirmed" | "empty";

export interface AllergenStatus {
  contains: string[];
  mayContain: string[];
  state: AllergenState;
  /** Product rows typed by hand: their allergens are not checked against the stock. */
  notInStock: string[];
  /** What changed since the confirmation. */
  added: string[];
  removed: string[];
  check?: AllergenCheck;
}

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((value) => b.includes(value));

export function containsAllergens(recipe: Pick<Recipe, "ingredients">): string[] {
  return unique((recipe.ingredients || []).flatMap((row) => row.allergens || []));
}

/** Which ingredients bring each allergen, for the kitchen tab: "Latte: Mozzarella, Burro". */
export function allergenSources(recipe: Pick<Recipe, "ingredients">): { allergen: string; ingredients: string[] }[] {
  return containsAllergens(recipe).map((allergen) => ({
    allergen,
    ingredients: unique((recipe.ingredients || []).filter((row) => (row.allergens || []).includes(allergen)).map((row) => row.name))
  }));
}

export function allergenStatus(recipe: Recipe, stockItems: StockItem[] = [], recipes: Recipe[] = []): AllergenStatus {
  const contains = containsAllergens(recipe);
  // An allergen the dish contains is not also listed as a trace.
  const mayContain = unique(recipe.mayContain || []).filter((value) => !contains.includes(value));
  const notInStock = unique((recipe.ingredients || []).filter((row) => isMissingFromStock(row, stockItems, recipes)).map((row) => row.name));
  const check = recipe.allergenCheck;
  const base = { contains, mayContain, notInStock, check, added: [] as string[], removed: [] as string[] };
  if (!(recipe.ingredients || []).length) return { ...base, state: "empty" };
  if (!check) return { ...base, state: "unconfirmed" };
  const before = [...check.contains, ...check.mayContain.map((value) => "~" + value)];
  const now = [...contains, ...mayContain.map((value) => "~" + value)];
  if (sameSet(before, now)) return { ...base, state: "ok" };
  return {
    ...base, state: "changed",
    added: unique([...contains.filter((value) => !check.contains.includes(value)), ...mayContain.filter((value) => !check.mayContain.includes(value))]),
    removed: unique([...check.contains.filter((value) => !contains.includes(value)), ...check.mayContain.filter((value) => !mayContain.includes(value))])
  };
}

/**
 * The confirmation saved with the dish. Ticking the box in this edit saves what the dish has now;
 * a box left ticked from before keeps the old copy, so a change of ingredients still asks for a
 * new check; an empty box removes it.
 */
export function nextAllergenCheck(recipe: Recipe, confirm: { confirmed: boolean; touched: boolean; by: string }, now = new Date().toISOString()): AllergenCheck | undefined {
  if (!confirm.confirmed) return undefined;
  if (recipe.allergenCheck && !confirm.touched) return recipe.allergenCheck;
  const status = allergenStatus({ ...recipe, allergenCheck: undefined });
  return { at: now, by: confirm.by.trim(), contains: status.contains, mayContain: status.mayContain };
}

/** Allergen columns of a matrix: the kitchen list first, then any other label the dishes use. */
export function matrixColumns(listed: string[], dishes: Recipe[]): string[] {
  const used = dishes.flatMap((dish) => { const status = allergenStatus(dish); return [...status.contains, ...status.mayContain]; });
  return unique([...listed, ...used.filter((value) => !listed.includes(value))]);
}

export interface MenuAllergenSummary { dishes: number; ok: number; toCheck: Recipe[] }

export function menuAllergenSummary(dishes: Recipe[], stockItems: StockItem[] = [], recipes: Recipe[] = []): MenuAllergenSummary {
  const toCheck = dishes.filter((dish) => allergenStatus(dish, stockItems, recipes).state !== "ok");
  return { dishes: dishes.length, ok: dishes.length - toCheck.length, toCheck };
}
