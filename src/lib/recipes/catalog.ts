import { num } from "@/lib/num";
import { allergens, calories, portionCost, portionsOf } from "@/lib/recipes/math";
import { unitFactor } from "@/lib/stock/units";
import type { Ingredient, Recipe, StockItem } from "@/lib/types";

// The stock catalogue is the one place where an ingredient is described. A recipe row only says
// which product (or base recipe) it uses and how much; name, supplier, cost, allergens and kcal are
// read from the product every time recipes are synced. Rows without a link ("free" rows, such as
// water) keep their own values.

export const PRODUCT = "Prodotto";
export const BASE = "Base / preparazione";
export const FREE = "Esterno";
const RECIPE_LINK = "recipe:";

const round4 = (value: number) => Math.round(value * 10000) / 10000;

export function linkedProduct(row: Pick<Ingredient, "stockItemId">, stockItems: StockItem[]): StockItem | undefined {
  if (!row.stockItemId || row.stockItemId.startsWith(RECIPE_LINK)) return undefined;
  return stockItems.find((item) => item.id === row.stockItemId);
}

export function linkedBase(row: Pick<Ingredient, "stockItemId">, recipes: Recipe[]): Recipe | undefined {
  if (!row.stockItemId?.startsWith(RECIPE_LINK)) return undefined;
  return recipes.find((recipe) => recipe.id === row.stockItemId!.slice(RECIPE_LINK.length));
}

/** True when the row's details come from the catalogue and should not be typed by hand. */
export function isLinked(row: Pick<Ingredient, "stockItemId">, stockItems: StockItem[], recipes: Recipe[]): boolean {
  return Boolean(linkedProduct(row, stockItems) || linkedBase(row, recipes));
}

/**
 * The row as the catalogue describes it. Cost and kcal follow the product in the row's unit
 * (a product priced per kg used in g costs a thousandth); when the units cannot convert, the
 * row keeps the values it had. A base recipe gives its cost and kcal per portion.
 */
export function resolveIngredient(row: Ingredient, stockItems: StockItem[], recipes: Recipe[]): Ingredient {
  const product = linkedProduct(row, stockItems);
  if (product) {
    const factor = unitFactor(row.unit, product.recipeUnit);
    const perUnit = num(product.price) / (num(product.recipeContent) || 1);
    return {
      ...row, type: PRODUCT, name: product.name, supplier: product.supplier || "", allergens: [...(product.allergens || [])],
      unitCost: factor === null ? num(row.unitCost) : round4(perUnit * factor),
      kcal: factor === null ? num(row.kcal) : round4(num(product.kcal) * factor)
    };
  }
  const base = linkedBase(row, recipes);
  if (base) {
    const perPortion = row.unit === "porz";
    return {
      ...row, type: BASE, name: base.name, supplier: "", allergens: allergens(base),
      unitCost: perPortion ? round4(portionCost(base)) : num(row.unitCost),
      kcal: perPortion ? round4(calories(base) / portionsOf(base)) : num(row.kcal)
    };
  }
  return row;
}

/**
 * Rows from older archives were copies without a link. A row whose name matches a product
 * exactly is linked to it, so from then on it follows the catalogue.
 */
export function linkByName(row: Ingredient, stockItems: StockItem[]): Ingredient {
  if (row.stockItemId || row.type === FREE || row.type === BASE) return row;
  const key = row.name.trim().toLocaleLowerCase();
  const product = key ? stockItems.find((item) => item.name.trim().toLocaleLowerCase() === key) : undefined;
  return product ? { ...row, stockItemId: product.id } : row;
}

export function resolveRecipe(recipe: Recipe, stockItems: StockItem[], recipes: Recipe[]): Recipe {
  return { ...recipe, ingredients: (recipe.ingredients || []).map((row) => resolveIngredient(linkByName(row, stockItems), stockItems, recipes)) };
}

/** Recipes whose rows no longer match the catalogue, already brought up to date, ready to save. */
export function recipesOutOfSync(recipes: Recipe[], stockItems: StockItem[]): Recipe[] {
  return recipes.flatMap((recipe) => {
    const synced = resolveRecipe(recipe, stockItems, recipes);
    return JSON.stringify(synced.ingredients) === JSON.stringify(recipe.ingredients || []) ? [] : [synced];
  });
}

/** Recipes that use a product, for the "used in" list of the product and before deleting it. */
export function recipesUsing(productId: string, recipes: Recipe[]): Recipe[] {
  return recipes.filter((recipe) => (recipe.ingredients || []).some((row) => row.stockItemId === productId));
}
