"use client";

import { useState } from "react";
import { PRINT_TITLES, PrintPreview } from "@/components/print/PrintPreview";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill } from "@/components/ui/Field";
import { dishesOfMenus, menuDishes, sortMenus } from "@/lib/menus/menus";
import { useApp } from "@/state/AppProvider";
import { useArchiveActions } from "@/state/actions/useArchiveActions";
import type { PrintMode } from "@/state/dialogs";

const DESCRIPTIONS: Record<PrintMode, string> = {
  recipes: "Ingredienti, porzioni e prezzo.",
  allergens: "Allergeni e tracce piatto per piatto.",
  matrix: "Griglia dei piatti del menu per i 14 allergeni, da esporre.",
  folder: "Metodo, ingredienti, allergeni e costi.",
  till: "Nomi e prezzi di vendita."
};

/** Print the current menu (or one recipe) and export the archive. */
export function PrintDialog({ mode: initialMode = "recipes", recipeId, menuId: initialMenu }: { mode?: PrintMode; recipeId?: string; menuId?: string }) {
  const { data, closeDialog, t, fmt } = useApp();
  const { exportCsv, exportJson } = useArchiveActions();
  const [mode, setMode] = useState<PrintMode>(initialMode);
  const [images, setImages] = useState(false);
  // "" prints every active menu together.
  const [menuId, setMenuId] = useState(initialMenu ?? "");
  const menu = data.menus.find((row) => row.id === menuId);
  const recipes = recipeId ? data.recipes.filter((item) => item.id === recipeId)
    : menu ? menuDishes(menu, data.recipes)
    : dishesOfMenus(data.menus, data.menus.filter((row) => row.active).map((row) => row.id), data.recipes);

  return (
    <Dialog>
      <DialogHeader kicker={t("STAMPA ED ESPORTAZIONE")} title={t("Prepara le tue stampe")} subtitle={t("Scegli il formato e controlla l'anteprima.")} />
      <div className="dialog-body">
        <div className="print-options">
          {(Object.keys(PRINT_TITLES) as PrintMode[]).map((value) => (
            <label key={value} className="print-option">
              <input type="radio" name="printMode" value={value} checked={mode === value} onChange={() => setMode(value)} />
              <span><strong>{t(PRINT_TITLES[value])}</strong><small>{t(DESCRIPTIONS[value])}</small></span>
            </label>
          ))}
        </div>
        {recipeId ? null : (
          <label className="print-menu-pick">
            <span>{t("Menu da stampare")}</span>
            <select value={menuId} onChange={(event) => setMenuId(event.target.value)}>
              <option value="">{t("Tutti i menu attivi")}</option>
              {sortMenus(data.menus).map((row) => <option key={row.id} value={row.id}>{row.name}{row.active ? "" : " · " + t("sospeso")}</option>)}
            </select>
          </label>
        )}
        <CheckPill checked={images} onChange={setImages} className="print-images">{t("Includi le immagini")}</CheckPill>
        <div className="print-preview"><PrintPreview mode={mode} recipes={recipes} images={images} single={Boolean(recipeId)} menuName={menu ? menu.name : t("Tutti i menu attivi")} /></div>
        <p className="print-help field-hint" style={{ marginTop: 9 }}>{recipeId ? t("Stampa della ricetta aperta.") : menu ? fmt(t("Piatti del menu “{0}”, nell'ordine del menu."), menu.name) : t("Piatti di tutti i menu attivi.")}</p>
      </div>
      <footer className="dialog-footer">
        <div>
          <button className="button button-quiet" type="button" onClick={exportCsv}>{t("Esporta CSV")}</button>
          <button className="button button-quiet" type="button" onClick={exportJson}>{t("Esporta JSON")}</button>
        </div>
        <div className="dialog-footer-right">
          <button className="button button-secondary" type="button" onClick={closeDialog}>{t("Chiudi")}</button>
          <button className="button button-primary print-actions" type="button" onClick={() => window.print()}>{t("Stampa")}</button>
        </div>
      </footer>
    </Dialog>
  );
}
