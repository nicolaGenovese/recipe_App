"use client";

import { clone, newId, upsert } from "@/lib/num";
import { assignRecipeToMenus } from "@/lib/menus/menus";
import { recipesWithStaleCosts } from "@/lib/stock/sources";
import type { Recipe } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

export function useRecipeActions() {
  const { current, update, notify, t, fmt, closeDialog } = useApp();

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
    await saveRecipe({ ...copy, id: newId(), name: recipe.name + " · " + t("copia"), createdAt: now, updatedAt: now });
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

  /** Saves every recipe whose linked ingredients changed price. Returns true when any did. */
  async function syncRecipeCosts(): Promise<boolean> {
    const stale = recipesWithStaleCosts(current().recipes, current().stockItems);
    for (const recipe of stale) await saveRecipe(recipe);
    return stale.length > 0;
  }

  return { saveRecipe, deleteRecipe, cloneRecipe, toggleArchive, syncRecipeCosts };
}
