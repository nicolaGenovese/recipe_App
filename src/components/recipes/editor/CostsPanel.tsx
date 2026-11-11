"use client";

import type { FormPatch } from "@/components/recipes/editor/RecipeEditorDialog";
import { Callout, MetricTile } from "@/components/ui/bits";
import { TextField } from "@/components/ui/Field";
import { ingredientFromDraft, type RecipeForm } from "@/lib/recipes/form";
import { calories, margin, portionCost, portionsOf, suggestPrice, totalCost } from "@/lib/recipes/math";
import { num } from "@/lib/num";
import { useApp } from "@/state/AppProvider";

export function CostsPanel({ form, patch }: { form: RecipeForm; patch: FormPatch }) {
  const { gpRules, f, t } = useApp();
  const recipe = {
    ingredients: form.ingredients.map(ingredientFromDraft), portions: num(form.portions),
    sellingPrice: num(form.sellingPrice), vat: num(form.vat), marginTarget: num(form.marginTarget)
  };
  const kcal = calories(recipe);

  return (
    <section className="editor-panel active">
      <div className="form-section">
        <h3 className="form-section-title">{t("Prezzo e margine")} <small>{t("calcolo per porzione")}</small></h3>
        <div className="pill-metrics">
          <MetricTile label={t("Costo ricetta")}>{f.money(totalCost(recipe))}</MetricTile>
          <MetricTile label={t("Costo / porzione")}>{f.money(portionCost(recipe))}</MetricTile>
          <MetricTile label={t("Margine teorico")}>{margin(recipe, gpRules).toFixed(1)}<small>%</small></MetricTile>
          <MetricTile label={t("Prezzo suggerito")}>{f.money(suggestPrice(recipe, gpRules))}</MetricTile>
        </div>
        <div className="form-grid cols-3">
          <TextField label={t("Prezzo vendita, IVA inclusa")} name="sellingPrice" type="number" step=".01" value={form.sellingPrice} onChange={(sellingPrice) => patch({ sellingPrice })} />
          <TextField label={t("IVA (%)")} name="vat" type="number" step=".1" max={100} value={form.vat} onChange={(vat) => patch({ vat })} />
          <TextField label={t("Margine obiettivo (%)")} name="marginTarget" type="number" step=".1" max={95} value={form.marginTarget} onChange={(marginTarget) => patch({ marginTarget })} />
        </div>
        <Callout title={t("Calcolo")}>{t("Margine teorico = (prezzo netto IVA − costo per porzione) ÷ prezzo netto IVA.")}</Callout>
      </div>
      <div className="form-section">
        <h3 className="form-section-title">{t("Energia dagli ingredienti")} <small>{t("stima")}</small></h3>
        <div className="pill-metrics">
          <MetricTile label={t("Totale ricetta")}>{Math.round(kcal)}<small> kcal</small></MetricTile>
          <MetricTile label={t("Per porzione")}>{Math.round(kcal / portionsOf(recipe))}<small> kcal</small></MetricTile>
        </div>
        <p className="field-hint">{t("Stima basata sui kcal per unità inseriti; verifica i valori sui prodotti effettivi.")}</p>
      </div>
    </section>
  );
}
