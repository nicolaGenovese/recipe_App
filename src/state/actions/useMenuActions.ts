"use client";

import { assignRecipeToMenus } from "@/lib/menus/menus";
import { newId, upsert } from "@/lib/num";
import type { Menu } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

export interface MenuInput { id?: string; name: string; description: string; active: boolean; recipeIds: string[] }

export function useMenuActions() {
  const { current, update, notify, t, fmt, closeDialog, view, setView } = useApp();

  async function persistMenu(menu: Menu): Promise<Menu> {
    const saved = await api.saveMenu(menu);
    update((data) => ({ ...data, menus: upsert(data.menus, saved) }));
    return saved;
  }

  async function saveMenu(input: MenuInput) {
    if (!input.name.trim()) { notify(t("Inserisci il nome del menu."), true); return; }
    const old = input.id ? current().menus.find((menu) => menu.id === input.id) : undefined;
    const now = new Date().toISOString();
    await persistMenu({ ...old, id: old?.id ?? newId(), name: input.name.trim(), description: input.description.trim(), active: input.active,
      recipeIds: input.recipeIds, createdAt: old?.createdAt ?? now, updatedAt: now });
    closeDialog();
    notify(t(old ? "Menu salvato." : "Menu creato."));
  }

  async function deleteMenu(id: string) {
    const menu = current().menus.find((row) => row.id === id);
    if (!menu || !window.confirm(fmt(t("Eliminare il menu “{0}”? Le ricette restano in archivio."), menu.name))) return;
    await api.deleteMenu(id);
    update((data) => ({ ...data, menus: data.menus.filter((row) => row.id !== id) }));
    if (view.menuId === id) setView({ menuId: null });
    closeDialog();
    notify(t("Menu eliminato."));
  }

  async function toggleActive(id: string) {
    const menu = current().menus.find((row) => row.id === id);
    if (!menu) return;
    const saved = await persistMenu({ ...menu, active: !menu.active });
    notify(t(saved.active ? "Menu attivato." : "Menu sospeso."));
  }

  /** Puts a dish on exactly these menus, saving only the menus that change. */
  async function setRecipeMenus(recipeId: string, menuIds: string[]) {
    for (const menu of assignRecipeToMenus(current().menus, recipeId, menuIds)) await persistMenu(menu);
  }

  return { saveMenu, deleteMenu, toggleActive, setRecipeMenus };
}
