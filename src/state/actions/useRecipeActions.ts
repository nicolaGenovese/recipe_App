"use client";

import { clone, newId, upsert } from "@/lib/num";
import { assignRecipeToMenus } from "@/lib/menus/menus";
import { recipesOutOfSync } from "@/lib/recipes/catalog";
import type { Recipe } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

export function useRecipeActions() {
  const { current, update, notify, t, fmt, closeDialog, can, access } = useApp();
  // Library recipes need "recipes.library", a site's own recipes "recipes.site".
  const editable = (recipe: Recipe) => (recipe.siteId ? can("recipes.site") : can("recipes.library"));

  const findRecipe = (id: string) => current().recipes.find((item) => item.id === id);

  async function saveRecipe(recipe: Recipe): Promise<Recipe> {
    const saved = await api.saveRecipe(recipe);
    update((data) => ({ ...data, recipes: upsert(data.recipes, saved) }));
    return saved;
  }

  async function deleteRecipe(id: string) {
    const recipe = findRecipe(id);
    if (!recipe || !window.confirm(fmt(t("Eliminare “{0}”? Questa azione non si può annullare."), recipe.name))) return;
    await api.deleteRecipe(id);
    update((data) => ({ ...data, recipes: data.recipes.filter((item) => item.id !== id) }));
    // A deleted dish leaves every menu too.
    for (const menu of assignRecipeToMenus(current().menus, id, [])) {
      const saved = await api.saveMenu(menu);
      update((data) => ({ ...data, menus: upsert(data.menus, saved) }));
    }
    closeDialog();
    notify(t("Ricetta eliminata."));
  }

  async function cloneRecipe(id: string) {
    const recipe = findRecipe(id);
    if (!recipe) return;
    const now = new Date().toISOString();
    const { currentMenu: _legacy, ...copy } = clone(recipe);
    // Whoever may only create site recipes gets the copy as a recipe of their site.
    const siteId = copy.siteId ?? (can("recipes.library") ? undefined : access?.site.id);
    await saveRecipe({ ...copy, siteId, id: newId(), name: recipe.name + " · " + t("copia"), createdAt: now, updatedAt: now });
    closeDialog();
    notify(t("Copia creata."));
  }

  async function toggleArchive(id: string) {
    const recipe = findRecipe(id);
    if (!recipe) return;
    await saveRecipe({ ...recipe, archivedBatch: !recipe.archivedBatch });
    closeDialog();
    notify(recipe.archivedBatch ? t("Rimossa dalle basi.") : t("Aggiunta a basi e preparazioni."));
  }

  /**
   * Brings every recipe in line with the ingredient catalogue: name, supplier, cost, allergens and
   * kcal of linked rows follow their product or base recipe. Returns true when any recipe changed.
   */
  async function syncRecipeCosts(): Promise<boolean> {
    // Only recipes this role may save; the others are aligned by whoever can edit them.
    const stale = recipesOutOfSync(current().recipes, current().stockItems).filter(editable);
    for (const recipe of stale) await saveRecipe(recipe);
    return stale.length > 0;
  }

  return { saveRecipe, deleteRecipe, cloneRecipe, toggleArchive, syncRecipeCosts };
}
