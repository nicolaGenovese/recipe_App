"use client";

import { IngredientRow } from "@/components/recipes/editor/IngredientRow";
import type { FormPatch } from "@/components/recipes/editor/RecipeEditorDialog";
import { Callout } from "@/components/ui/bits";
import { Datalist } from "@/components/ui/Field";
import { ingredientDraft, ingredientFromDraft, matchIngredient, type IngredientDraft, type RecipeForm } from "@/lib/recipes/form";
import { totalCost } from "@/lib/recipes/math";
import { stockSources } from "@/lib/stock/sources";
import { useApp } from "@/state/AppProvider";

export function IngredientsPanel({ form, patch }: { form: RecipeForm; patch: FormPatch }) {
  const { data, f, t } = useApp();
  const sources = stockSources(data.stockItems, data.recipes);
  const names = Array.from(new Set(data.recipes.flatMap((item) => (item.ingredients || []).map((row) => row.name))
    .concat(data.recipes.filter((item) => item.archivedBatch).map((item) => item.name), data.stockItems.map((item) => item.name)).filter(Boolean)));
  const suppliers = Array.from(new Set(data.recipes.flatMap((item) => (item.ingredients || []).map((row) => row.supplier)).filter(Boolean)));

  const change = (key: string, update: Partial<IngredientDraft>) => patch((old) => ({
    ingredients: old.ingredients.map((row) => {
      if (row.key !== key) return row;
      const next = { ...row, ...update };
      return update.name !== undefined ? matchIngredient(next, sources) : next;
    })
  }));
  const total = totalCost({ ingredients: form.ingredients.map(ingredientFromDraft) });

  return (
    <section className="editor-panel active">
      <div className="form-section">
        <h3 className="form-section-title">{t("Ingredienti e approvvigionamento")} <small>{t("quantità × costo per unità")}</small></h3>
        <div className="ingredient-labels">
          <span>{t("Tipo")}</span><span>{t("Ingrediente")}</span><span>{t("Fornitore")}</span><span>{t("Qtà")}</span><span>{t("Unità")}</span><span>{f.withCurrency(t("€/unità"))}</span><span>{t("Totale")}</span><span />
        </div>
        <div className="ingredient-list">
          {form.ingredients.map((row) => (
            <IngredientRow key={row.key} row={row} onChange={(update) => change(row.key, update)} onRemove={() => patch((old) => ({ ingredients: old.ingredients.filter((item) => item.key !== row.key) }))} />
          ))}
        </div>
        <Datalist id="ingredientNames" values={names} />
        <Datalist id="ingredientSuppliers" values={suppliers} />
        <button type="button" className="settings-add" onClick={() => patch((old) => ({ ingredients: [...old.ingredients, ingredientDraft()] }))}>{t("+ Aggiungi ingrediente")}</button>
        <div className="ingredient-total"><span>{t("Costo totale ricetta")}</span><strong>{f.money(total)}</strong></div>
        <Callout title="Tip">{t("Inserisci gli allergeni e i kcal per unità per alimentare schede e stampe.")}</Callout>
      </div>
    </section>
  );
}
