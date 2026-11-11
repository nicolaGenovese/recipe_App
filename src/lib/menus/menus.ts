import { margin, portionCost, recipeNetPrice } from "@/lib/recipes/math";
import { num } from "@/lib/num";
import type { GpRules, Menu, Recipe } from "@/lib/types";

/** Ids of the dishes that are on at least one active menu. */
export function menuRecipeIds(menus: Menu[]): Set<string> {
  return new Set(menus.filter((menu) => menu.active).flatMap((menu) => menu.recipeIds));
}

/** Menus that list the given dish, active or not. */
export function menusOfRecipe(menus: Menu[], recipeId: string): Menu[] {
  return menus.filter((menu) => menu.recipeIds.includes(recipeId));
}

/** The menu's dishes in menu order, skipping ids whose recipe was deleted. */
export function menuDishes(menu: Pick<Menu, "recipeIds">, recipes: Recipe[]): Recipe[] {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  return menu.recipeIds.map((id) => byId.get(id)).filter((recipe): recipe is Recipe => Boolean(recipe));
}

/** Dishes of several menus, each once, in the order the menus list them. */
export function dishesOfMenus(menus: Menu[], menuIds: string[], recipes: Recipe[]): Recipe[] {
  const seen = new Set<string>();
  return menus.filter((menu) => menuIds.includes(menu.id)).flatMap((menu) => menuDishes(menu, recipes)).filter((recipe) => {
    if (seen.has(recipe.id)) return false;
    seen.add(recipe.id);
    return true;
  });
}

export interface MenuStats {
  dishes: number;
  /** Average cost per portion. */
  averageCost: number;
  /** Average selling price. */
  averagePrice: number;
  /** Food cost as a share of net prices, over the priced dishes. */
  foodCostPercent: number;
  /** Average theoretical margin over the priced dishes. */
  averageMargin: number;
  unpriced: number;
}

export function menuStats(menu: Pick<Menu, "recipeIds">, recipes: Recipe[], rules: Pick<GpRules, "recipeMarginOnNet">): MenuStats {
  const dishes = menuDishes(menu, recipes);
  const priced = dishes.filter((recipe) => num(recipe.sellingPrice) > 0);
  const net = priced.reduce((total, recipe) => total + recipeNetPrice(recipe.sellingPrice, recipe.vat, rules), 0);
  const pricedCost = priced.reduce((total, recipe) => total + portionCost(recipe), 0);
  const average = (rows: Recipe[], read: (recipe: Recipe) => number) => (rows.length ? rows.reduce((total, recipe) => total + read(recipe), 0) / rows.length : 0);
  return {
    dishes: dishes.length,
    averageCost: average(dishes, portionCost),
    averagePrice: average(priced, (recipe) => num(recipe.sellingPrice)),
    foodCostPercent: net > 0 ? (pricedCost / net) * 100 : 0,
    averageMargin: average(priced, (recipe) => margin(recipe, rules)),
    unpriced: dishes.length - priced.length
  };
}

/**
 * Puts a dish on exactly the given menus. Returns only the menus that changed, ready to save.
 * A dish added to a menu goes to the end of it.
 */
export function assignRecipeToMenus(menus: Menu[], recipeId: string, menuIds: string[], now = new Date().toISOString()): Menu[] {
  return menus.flatMap((menu) => {
    const has = menu.recipeIds.includes(recipeId);
    const wants = menuIds.includes(menu.id);
    if (has === wants) return [];
    const recipeIds = wants ? [...menu.recipeIds, recipeId] : menu.recipeIds.filter((id) => id !== recipeId);
    return [{ ...menu, recipeIds, updatedAt: now }];
  });
}

export const LEGACY_MENU_ID = "main-menu";

/** Archives from before menus existed: the dishes marked "current menu" become the first menu. */
export function legacyMenus(recipes: Pick<Recipe, "id" | "currentMenu">[], name: string, id: string, now = new Date().toISOString()): Menu[] {
  const recipeIds = recipes.filter((recipe) => recipe.currentMenu).map((recipe) => recipe.id);
  return recipeIds.length ? [{ id, name, description: "", active: true, recipeIds, createdAt: now, updatedAt: now }] : [];
}

/** Menus sorted for display: active ones first, then by name. */
export function sortMenus(menus: Menu[]): Menu[] {
  return [...menus].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}
