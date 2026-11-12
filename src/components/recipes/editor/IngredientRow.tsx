"use client";

import { AllergenPicker } from "@/components/ui/AllergenPicker";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { INGREDIENT_TYPES, type IngredientDraft } from "@/lib/recipes/form";
import { num } from "@/lib/num";
import { useApp } from "@/state/AppProvider";

export function IngredientRow({ row, onChange, onRemove }: { row: IngredientDraft; onChange: (change: Partial<IngredientDraft>) => void; onRemove: () => void }) {
  const { f, t } = useApp();
  return (
    <div className="ingredient-entry">
      <div className="ingredient-row">
        <select aria-label={t("Tipo")} value={row.type} onChange={(event) => onChange({ type: event.target.value })}>
          {INGREDIENT_TYPES.map((type) => <option key={type} value={type}>{t(type)}</option>)}
        </select>
        <input list="ingredientNames" value={row.name} aria-label={t("Ingrediente")} placeholder={t("Ingrediente")} onChange={(event) => onChange({ name: event.target.value })} />
        <input list="ingredientSuppliers" value={row.supplier} aria-label={t("Fornitore")} placeholder={t("Fornitore / origine")} onChange={(event) => onChange({ supplier: event.target.value })} />
        <input type="number" min="0" step="0.001" value={row.quantity} aria-label={t("Quantità")} placeholder={t("Qtà")} onChange={(event) => onChange({ quantity: event.target.value })} />
        <UnitSelect value={row.unit} onChange={(unit) => onChange({ unit })} />
        <input type="number" min="0" step="any" value={row.unitCost} aria-label={t("Costo unitario")} placeholder={f.withCurrency(t("€/unità"))} onChange={(event) => onChange({ unitCost: event.target.value })} />
        <span className="ingredient-cost-output">{f.money(num(row.quantity) * num(row.unitCost))}</span>
        <button type="button" className="remove-ingredient" onClick={onRemove} aria-label={t("Rimuovi ingrediente")}>×</button>
      </div>
      <div className="ingredient-extra-row">
        <AllergenPicker value={row.allergens} onChange={(allergens) => onChange({ allergens })} />
        <input type="number" min="0" step="0.1" value={row.kcal} aria-label={t("kcal per unità")} placeholder={t("kcal / unità")} onChange={(event) => onChange({ kcal: event.target.value })} />
      </div>
    </div>
  );
}
