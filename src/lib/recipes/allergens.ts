import { allergensToFill, isMissingFromStock, linkedBase, linkedProduct } from "@/lib/recipes/catalog";
import { traces } from "@/lib/recipes/math";
import type { AllergenCheck, Recipe, StockItem } from "@/lib/types";

// Allergens of a dish come only from its ingredients: the product in the stock is the one source,
// and base recipes pass on their own. Traces ("may contain") come from the products' labels and the
// bases, and the kitchen can add its own (shared fryer), never remove inherited ones. The kitchen
// confirms the result, which is possible only when every ingredient's allergens have been checked;
// the confirmation keeps a copy, so any later change shows up as "to check again".

export type AllergenState = "ok" | "changed" | "unconfirmed" | "unverified" | "empty";

export interface AllergenStatus {
  contains: string[];
  mayContain: string[];
  state: AllergenState;
  /** Product rows typed by hand: their allergens are not checked against the stock. */
  notInStock: string[];
  /** Products (or bases) whose allergens nobody has checked yet. */
  toFill: string[];
  /** Traces that come from the ingredients; the dish's own are the rest of mayContain. */
  inherited: string[];
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

/**
 * Ingredients whose allergens are not checked: products still to fill in, and base recipes that
 * have such ingredients themselves (followed a few levels down, never in a loop).
 */
function unchecked(recipe: Pick<Recipe, "ingredients">, stockItems: StockItem[], recipes: Recipe[], depth = 0): string[] {
  if (depth > 4) return [];
  return unique((recipe.ingredients || []).flatMap((row) => {
    const product = linkedProduct(row, stockItems);
    if (product) return allergensToFill(product) ? [product.name] : [];
    const base = linkedBase(row, recipes);
    if (!base) return [];
    const inside = (base.ingredients || []).some((item) => isMissingFromStock(item, stockItems, recipes)) || unchecked(base, stockItems, recipes, depth + 1).length > 0;
    return inside ? [base.name] : [];
  }));
}

export function allergenStatus(recipe: Recipe, stockItems: StockItem[] = [], recipes: Recipe[] = []): AllergenStatus {
  const contains = containsAllergens(recipe);
  // An allergen the dish contains is not also listed as a trace.
  const mayContain = traces(recipe);
  const inherited = traces({ ingredients: recipe.ingredients });
  const notInStock = unique((recipe.ingredients || []).filter((row) => isMissingFromStock(row, stockItems, recipes)).map((row) => row.name));
  const toFill = unchecked(recipe, stockItems, recipes);
  const check = recipe.allergenCheck;
  const base = { contains, mayContain, inherited, notInStock, toFill, check, added: [] as string[], removed: [] as string[] };
  if (!(recipe.ingredients || []).length) return { ...base, state: "empty" };
  // Allergens typed by hand or not checked on the label cannot be confirmed, whatever was confirmed before.
  if (notInStock.length || toFill.length) return { ...base, state: "unverified" };
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
 * new check; an empty box removes it. A new confirmation needs every ingredient checked.
 */
export function nextAllergenCheck(recipe: Recipe, confirm: { confirmed: boolean; touched: boolean; by: string }, now = new Date().toISOString(), stockItems: StockItem[] = [], recipes: Recipe[] = []): AllergenCheck | undefined {
  if (!confirm.confirmed) return undefined;
  if (recipe.allergenCheck && !confirm.touched) return recipe.allergenCheck;
  const status = allergenStatus({ ...recipe, allergenCheck: undefined }, stockItems, recipes);
  if (status.state === "unverified") return undefined;
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
