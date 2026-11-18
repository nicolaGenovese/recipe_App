import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

/** What the signed-in role may do with recipes; buttons it cannot use are not shown (the server checks anyway). */
export function useRecipeRights() {
  const { can } = useApp();
  return {
    canCreate: can("recipes.library") || can("recipes.site"),
    canEdit: (recipe: Pick<Recipe, "siteId">) => (recipe.siteId ? can("recipes.site") : can("recipes.library")),
    canMenus: can("menus.edit")
  };
}
