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

/** Recipes matching the sidebar view, category chip and search, in the chosen order. */
export function visibleRecipes(recipes: Recipe[], view: Pick<ViewState, "filter" | "menuId" | "category" | "query" | "sort">, menus: Menu[] = []): Recipe[] {
  const query = view.query.trim().toLocaleLowerCase("it");
  const onMenu = view.filter === "menu" ? menuFilterIds(menus, view.menuId) : null;
  const rows = recipes.filter((recipe) => {
    if (onMenu && !onMenu.has(recipe.id)) return false;
    if (view.filter === "archive" && !recipe.archivedBatch) return false;
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
