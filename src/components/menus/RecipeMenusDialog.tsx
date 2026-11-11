"use client";

import { useState } from "react";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill } from "@/components/ui/Field";
import { menusOfRecipe, sortMenus } from "@/lib/menus/menus";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useMenuActions } from "@/state/actions/useMenuActions";

/** Choose which menus a dish is on. */
export function RecipeMenusDialog({ id }: { id: string }) {
  const { data, closeDialog, openDialog, notify, t } = useApp();
  const guard = useGuard();
  const { setRecipeMenus } = useMenuActions();
  const recipe = data.recipes.find((item) => item.id === id);
  const [picked, setPicked] = useState(() => menusOfRecipe(data.menus, id).map((menu) => menu.id));
  if (!recipe) return null;

  const save = guard(async () => {
    await setRecipeMenus(id, picked);
    closeDialog();
    notify(t("Menu aggiornati."));
  });

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("MENU")} title={recipe.name} subtitle={t("Scegli in quali menu compare questo piatto.")} />
      <div className="dialog-body">
        <div className="form-checks menu-pick-list">
          {sortMenus(data.menus).map((menu) => (
            <CheckPill key={menu.id} checked={picked.includes(menu.id)} onChange={(on) => setPicked((old) => (on ? [...old, menu.id] : old.filter((other) => other !== menu.id)))}>
              {menu.name}{menu.active ? "" : " · " + t("sospeso")}
            </CheckPill>
          ))}
        </div>
        {data.menus.length ? null : <p className="field-hint">{t("Nessun menu: creane uno dalla pagina Menu.")}</p>}
      </div>
      <footer className="dialog-footer">
        <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "menuEditor" })}>{t("Nuovo menu")}</button>
        <div className="dialog-footer-right">
          <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
          <button className="button button-primary" type="button" onClick={save}>{t("Salva")}</button>
        </div>
      </footer>
    </Dialog>
  );
}
