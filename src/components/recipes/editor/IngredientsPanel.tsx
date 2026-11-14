"use client";

import { IngredientRow } from "@/components/recipes/editor/IngredientRow";
import { NewProductPanel } from "@/components/recipes/editor/NewProductPanel";
import type { FormPatch } from "@/components/recipes/editor/RecipeEditorDialog";
import { Callout } from "@/components/ui/bits";
import { Datalist } from "@/components/ui/Field";
import { changeUnit, ingredientDraft, ingredientFromDraft, matchIngredient, type IngredientDraft, type RecipeForm } from "@/lib/recipes/form";
import { resolveIngredient } from "@/lib/recipes/catalog";
import { totalCost } from "@/lib/recipes/math";
import { stockSources } from "@/lib/stock/sources";
import type { StockItem } from "@/lib/types";
import { useState } from "react";
import { useApp } from "@/state/AppProvider";
import { useStockActions } from "@/state/actions/useStockActions";

export function IngredientsPanel({ form, patch }: { form: RecipeForm; patch: FormPatch }) {
  const { data, f, t } = useApp();
  const { createProduct } = useStockActions();
  // The row whose full product sheet is open under it.
  const [adding, setAdding] = useState<string | null>(null);
  const sources = stockSources(data.stockItems, data.recipes);
  const names = Array.from(new Set(data.recipes.flatMap((item) => (item.ingredients || []).map((row) => row.name))
    .concat(data.recipes.filter((item) => item.archivedBatch).map((item) => item.name), data.stockItems.map((item) => item.name)).filter(Boolean)));
  const suppliers = Array.from(new Set(data.recipes.flatMap((item) => (item.ingredients || []).map((row) => row.supplier)).filter(Boolean)));

  const change = (key: string, update: Partial<IngredientDraft>) => patch((old) => ({
    ingredients: old.ingredients.map((row) => {
      if (row.key !== key) return row;
      if (update.unit !== undefined && update.unit !== row.unit) return changeUnit(row, update.unit);
      const next = { ...row, ...update };
      return update.name !== undefined ? matchIngredient(next, sources) : next;
    })
  }));
  const total = totalCost({ ingredients: form.ingredients.map((row) => resolveIngredient(ingredientFromDraft(row), data.stockItems, data.recipes)) });

  /** The product made from the full sheet; the row links to it and from now on follows the stock. */
  const addToCatalog = async (key: string, item: StockItem) => {
    const product = await createProduct(item);
    patch((old) => ({ ingredients: old.ingredients.map((row) => (row.key === key ? { ...row, stockItemId: product.id, type: "Prodotto", name: product.name } : row)) }));
    setAdding(null);
  };

  return (
    <section className="editor-panel active">
      <div className="form-section">
        <h3 className="form-section-title">{t("Ingredienti e approvvigionamento")} <small>{t("quantità × costo per unità")}</small></h3>
        <div className="ingredient-labels">
          <span>{t("Tipo")}</span><span>{t("Ingrediente")}</span><span>{t("Fornitore")}</span><span>{t("Qtà")}</span><span>{t("Unità")}</span><span>{f.withCurrency(t("€/unità"))}</span><span>{t("Totale")}</span><span />
        </div>
        <div className="ingredient-list">
          {form.ingredients.map((row) => (
            <div key={row.key}>
              <IngredientRow row={row} onChange={(update) => change(row.key, update)} adding={adding === row.key} onAddToCatalog={() => setAdding(adding === row.key ? null : row.key)}
                onRemove={() => patch((old) => ({ ingredients: old.ingredients.filter((item) => item.key !== row.key) }))} />
              {adding === row.key ? <NewProductPanel row={ingredientFromDraft(row)} onCreate={(item) => addToCatalog(row.key, item)} onCancel={() => setAdding(null)} /> : null}
            </div>
          ))}
        </div>
        <Datalist id="ingredientNames" values={names} />
        <Datalist id="ingredientSuppliers" values={suppliers} />
        <button type="button" className="settings-add" onClick={() => patch((old) => ({ ingredients: [...old.ingredients, ingredientDraft()] }))}>{t("+ Aggiungi ingrediente")}</button>
        <div className="ingredient-total"><span>{t("Costo totale ricetta")}</span><strong>{f.money(total)}</strong></div>
        <Callout title="Tip">{t("Scegli gli ingredienti dal magazzino: prezzo, allergeni e kcal arrivano dal prodotto e restano aggiornati in tutte le ricette. Se un ingrediente manca, scrivilo e premi \"+ Aggiungi al magazzino\" per compilarne la scheda completa. Puoi anche salvare senza: resterà tra gli avvisi in alto a destra.")}</Callout>
      </div>
    </section>
  );
}
