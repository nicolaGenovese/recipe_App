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

  /**
   * Creates an empty active menu without closing the open window, so the recipe editor can make one
   * and tick it straight away. A name already used returns that menu instead of a copy.
   */
  async function createMenu(name: string): Promise<Menu | null> {
    const clean = name.trim();
    if (!clean) { notify(t("Inserisci il nome del menu."), true); return null; }
    const existing = current().menus.find((menu) => menu.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase());
    if (existing) return existing;
    const now = new Date().toISOString();
    const saved = await persistMenu({ id: newId(), name: clean, description: "", active: true, recipeIds: [], createdAt: now, updatedAt: now });
    notify(fmt(t("Menu “{0}” creato."), saved.name));
    return saved;
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

  return { saveMenu, createMenu, deleteMenu, toggleActive, setRecipeMenus };
}
