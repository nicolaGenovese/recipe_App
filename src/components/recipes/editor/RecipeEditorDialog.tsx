"use client";

import { useState, type FormEvent } from "react";
import { CostsPanel } from "@/components/recipes/editor/CostsPanel";
import { GeneralPanel } from "@/components/recipes/editor/GeneralPanel";
import { IngredientsPanel } from "@/components/recipes/editor/IngredientsPanel";
import { KitchenPanel } from "@/components/recipes/editor/KitchenPanel";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { fromForm, toForm, type RecipeForm } from "@/lib/recipes/form";
import { isMissingFromStock, resolveRecipe } from "@/lib/recipes/catalog";
import { nextAllergenCheck } from "@/lib/recipes/allergens";
import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useMenuActions } from "@/state/actions/useMenuActions";
import { useRecipeActions } from "@/state/actions/useRecipeActions";
import { menusOfRecipe } from "@/lib/menus/menus";

export type EditorTab = "general" | "ingredients" | "kitchen" | "costs";
export type FormPatch = (change: Partial<RecipeForm> | ((form: RecipeForm) => Partial<RecipeForm>)) => void;

const TABS: [EditorTab, string][] = [["general", "Panoramica"], ["ingredients", "Ingredienti"], ["kitchen", "Cucina & allergeni"], ["costs", "Costi & prezzo"]];

/** Create or edit a recipe. Opening it with a partial recipe (no id) prefills a new one. */
export function RecipeEditorDialog({ initial, startTab = "general" }: { initial?: Partial<Recipe>; startTab?: EditorTab }) {
  const { data, gpRules, t, fmt, notify, closeDialog, current } = useApp();
  const { saveRecipe, deleteRecipe, syncRecipeCosts } = useRecipeActions();
  const { setRecipeMenus } = useMenuActions();
  const recipe = initial?.id ? data.recipes.find((item) => item.id === initial.id) ?? initial : initial ?? {};
  const isNew = !recipe.id;
  const [form, setForm] = useState<RecipeForm>(() => toForm(recipe, {
    category: data.settings.categories[0] || "Senza categoria", cookingMethod: data.settings.cookingMethods[0] || "", creator: t("Team cucina"), rules: gpRules,
    menuIds: recipe.id ? menusOfRecipe(data.menus, recipe.id).map((menu) => menu.id) : []
  }));
  const [tab, setTab] = useState<EditorTab>(startTab);
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");
  const patch: FormPatch = (change) => setForm((old) => ({ ...old, ...(typeof change === "function" ? change(old) : change) }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setTab("general");
      notify(t("Inserisci il nome della ricetta."), true);
      requestAnimationFrame(() => document.getElementById("field-name")?.focus());
      return;
    }
    setSaving("saving");
    try {
      const old = current().recipes.find((item) => item.id === form.id);
      const draft = fromForm(form, old);
      // Linked rows are saved as the catalogue describes them, whatever the form showed.
      const resolved = resolveRecipe(draft, current().stockItems, current().recipes);
      const check = nextAllergenCheck(resolved, { confirmed: form.allergensConfirmed, touched: form.allergensTouched, by: form.allergensCheckedBy });
      const { allergenCheck: _old, ...rest } = resolved;
      const saved = await saveRecipe(check ? { ...rest, allergenCheck: check } : rest);
      await setRecipeMenus(saved.id, form.menuIds);
      // A base recipe passes its new cost and allergens to the dishes that use it.
      if (saved.archivedBatch) await syncRecipeCosts();
      closeDialog();
      // Saving is allowed with ingredients not in stock; they stay in the notifications at the top right.
      const missing = saved.ingredients.filter((row) => isMissingFromStock(row, current().stockItems, current().recipes)).map((row) => row.name.trim());
      const done = isNew ? t("Ricetta creata.") : t("Modifiche salvate.");
      notify(missing.length ? done + " " + fmt(t("Non nel magazzino: {0}."), missing.join(", ")) : done, missing.length > 0);
    } catch (error) {
      setSaving("failed");
      notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true);
    }
  }

  return (
    <Dialog>
      <DialogHeader kicker={isNew ? t("NUOVA SCHEDA") : t("MODIFICA SCHEDA")} title={isNew ? t("Crea una ricetta") : t("Modifica ricetta")} subtitle={t("Ingredienti, costi e indicazioni operative in un'unica scheda.")} />
      <form id="recipeForm" onSubmit={submit}>
        <div className="editor-tabs">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={"editor-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{t(label)}</button>
          ))}
        </div>
        <div className="dialog-body">
          {tab === "general" ? <GeneralPanel form={form} patch={patch} /> : null}
          {tab === "ingredients" ? <IngredientsPanel form={form} patch={patch} /> : null}
          {tab === "kitchen" ? <KitchenPanel form={form} patch={patch} /> : null}
          {tab === "costs" ? <CostsPanel form={form} patch={patch} /> : null}
        </div>
        <footer className="dialog-footer">
          <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
          <div className="dialog-footer-right">
            {isNew ? null : <button className="button button-quiet" type="button" onClick={() => deleteRecipe(form.id).catch((error) => notify(t(error.message), true))}>{t("Elimina")}</button>}
            <button className="button button-primary" type="submit" disabled={saving === "saving"}>
              {saving === "saving" ? t("Salvataggio…") : saving === "failed" ? t("Riprova") : isNew ? t("Crea ricetta") : t("Salva modifiche")}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
