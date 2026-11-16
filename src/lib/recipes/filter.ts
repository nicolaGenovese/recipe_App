import { portionCost } from "@/lib/recipes/math";
import type { Menu, Recipe } from "@/lib/types";
import { ALL_CATEGORIES, type RecipeSort, type ViewState } from "@/state/view";

const SORTS: Record<RecipeSort, (a: Recipe, b: Recipe) => number> = {
  updated: (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  name: (a, b) => a.name.localeCompare(b.name, "it"),
  category: (a, b) => (a.category || "").localeCompare(b.category || "", "it") || a.name.localeCompare(b.name, "it"),
  "cost-high": (a, b) => portionCost(b) - portionCost(a),
  "cost-low": (a, b) => portionCost(a) - portionCost(b)
};

/** Dish ids shown by the "menu" view: one menu, or every active menu when none is picked. */
export function menuFilterIds(menus: Menu[], menuId: string | null): Set<string> {
  const picked = menuId ? menus.filter((menu) => menu.id === menuId) : menus.filter((menu) => menu.active);
  return new Set(picked.flatMap((menu) => menu.recipeIds));
}

/** Recipes of the sidebar view alone (one menu, the active menus, the bases or everything), before chips and search. */
export function scopedRecipes(recipes: Recipe[], view: Pick<ViewState, "filter" | "menuId">, menus: Menu[] = []): Recipe[] {
  const onMenu = view.filter === "menu" ? menuFilterIds(menus, view.menuId) : null;
  return recipes.filter((recipe) => (!onMenu || onMenu.has(recipe.id)) && (view.filter !== "archive" || recipe.archivedBatch));
}

/** Recipes matching the sidebar view, category chip and search, in the chosen order. */
export function visibleRecipes(recipes: Recipe[], view: Pick<ViewState, "filter" | "menuId" | "category" | "query" | "sort">, menus: Menu[] = []): Recipe[] {
  const query = view.query.trim().toLocaleLowerCase("it");
  const rows = scopedRecipes(recipes, view, menus).filter((recipe) => {
    if (view.category !== ALL_CATEGORIES && recipe.category !== view.category) return false;
    if (!query) return true;
    const words = [recipe.name, recipe.category, recipe.description, recipe.cookingMethod, recipe.creator, recipe.method]
      .concat((recipe.ingredients || []).flatMap((item) => [item.name, item.supplier, item.type].concat(item.allergens || [])))
      .join(" ").toLocaleLowerCase("it");
    return words.includes(query);
  });
  return rows.sort(SORTS[view.sort] || SORTS.updated);
}

/** Category chips: the settings list first, then any category only used by recipes. */
export function categoryList(settingsCategories: string[], recipes: Recipe[]): string[] {
  return [ALL_CATEGORIES].concat(Array.from(new Set((settingsCategories || []).concat(recipes.map((item) => item.category).filter(Boolean)))));
}

export interface CategoryChip { category: string; count: number }

/**
 * Chips for what is on screen, counted on the recipes of the view. With every recipe the whole
 * list shows, as before; inside a menu (or the bases) only the categories it uses show, in the
 * settings order, plus the chip already picked so it can be cleared.
 */
export function categoryChips(settingsCategories: string[], scoped: Recipe[], wholeArchive: boolean, picked: string = ALL_CATEGORIES): CategoryChip[] {
  const counts = new Map<string, number>();
  for (const recipe of scoped) if (recipe.category) counts.set(recipe.category, (counts.get(recipe.category) || 0) + 1);
  return categoryList(settingsCategories, scoped)
    .filter((category) => category === ALL_CATEGORIES || wholeArchive || counts.has(category) || category === picked)
    .map((category) => ({ category, count: category === ALL_CATEGORIES ? scoped.length : counts.get(category) || 0 }));
}
