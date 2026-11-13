"use client";

import { AllergenPicker } from "@/components/ui/AllergenPicker";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { FREE, linkedBase, linkedProduct, resolveIngredient } from "@/lib/recipes/catalog";
import { ingredientFromDraft, INGREDIENT_TYPES, type IngredientDraft } from "@/lib/recipes/form";
import { num } from "@/lib/num";
import { useApp } from "@/state/AppProvider";

interface Props {
  row: IngredientDraft;
  onChange: (change: Partial<IngredientDraft>) => void;
  onRemove: () => void;
  /** Adds this free row to the stock catalogue and links it. */
  onAddToCatalog: () => void;
}

/**
 * One ingredient of the recipe. A row linked to a product (or a base recipe) only sets quantity
 * and unit: supplier, cost, allergens and kcal come from the catalogue and are changed there.
 * A free row keeps its own values and can be added to the catalogue with one click.
 */
export function IngredientRow({ row, onChange, onRemove, onAddToCatalog }: Props) {
  const { data, f, t } = useApp();
  const product = linkedProduct(row, data.stockItems);
  const base = linkedBase(row, data.recipes);
  const linked = Boolean(product || base);
  // What the row will be saved as: the catalogue values in the row's unit.
  const shown = linked ? resolveIngredient(ingredientFromDraft(row), data.stockItems, data.recipes) : null;
  const unitCost = shown ? shown.unitCost : num(row.unitCost);
  const canAdd = !linked && row.type !== FREE && row.name.trim().length > 0;

  return (
    <div className={"ingredient-entry" + (linked ? " linked" : "")}>
      <div className="ingredient-row">
        {linked ? (
          <span className="ingredient-type-badge" title={t(product ? "Collegato a un prodotto del magazzino" : "Collegato a una ricetta base")}>{t(product ? "Prodotto" : "Base")}</span>
        ) : (
          <select aria-label={t("Tipo")} value={row.type} onChange={(event) => onChange({ type: event.target.value })}>
            {INGREDIENT_TYPES.map((type) => <option key={type} value={type}>{t(type)}</option>)}
          </select>
        )}
        <input list="ingredientNames" value={row.name} aria-label={t("Ingrediente")} placeholder={t("Cerca o scrivi un ingrediente")} onChange={(event) => onChange({ name: event.target.value })} />
        {linked
          ? <span className="ingredient-readonly">{shown?.supplier || "—"}</span>
          : <input list="ingredientSuppliers" value={row.supplier} aria-label={t("Fornitore")} placeholder={t("Fornitore / origine")} onChange={(event) => onChange({ supplier: event.target.value })} />}
        <input type="number" min="0" step="0.001" value={row.quantity} aria-label={t("Quantità")} placeholder={t("Qtà")} onChange={(event) => onChange({ quantity: event.target.value })} />
        <UnitSelect value={row.unit} onChange={(unit) => onChange({ unit })} />
        {linked
          ? <span className="ingredient-readonly" title={t("Prezzo del magazzino convertito nell'unità della riga")}>{f.unitMoney(unitCost)}</span>
          : <input type="number" min="0" step="any" value={row.unitCost} aria-label={t("Costo unitario")} placeholder={f.withCurrency(t("€/unità"))} onChange={(event) => onChange({ unitCost: event.target.value })} />}
        <span className="ingredient-cost-output">{f.money(num(row.quantity) * unitCost)}</span>
        <button type="button" className="remove-ingredient" onClick={onRemove} aria-label={t("Rimuovi ingrediente")}>×</button>
      </div>
      <div className="ingredient-extra-row">
        {linked ? (
          <span className="ingredient-readonly ingredient-allergens">
            {shown?.allergens.length ? shown.allergens.map((item) => <span key={item} className="allergen-tag">{t(item)}</span>) : <span className="field-hint">{t("Nessun allergene")}</span>}
          </span>
        ) : (
          <AllergenPicker value={row.allergens} onChange={(allergens) => onChange({ allergens })} />
        )}
        {linked
          ? <span className="ingredient-readonly">{shown?.kcal ? Math.round(shown.kcal * 10) / 10 + " kcal/" + row.unit : "— kcal"}</span>
          : <input type="number" min="0" step="0.1" value={row.kcal} aria-label={t("kcal per unità")} placeholder={t("kcal / unità")} onChange={(event) => onChange({ kcal: event.target.value })} />}
      </div>
      <div className="ingredient-source">
        {product ? <small>{t("Dal magazzino: fornitore, prezzo, allergeni e kcal si cambiano in Food Stock → Inventario e valgono per tutte le ricette.")}</small> : null}
        {base ? <small>{t("Dalla ricetta base: costo per porzione e allergeni seguono la base.")}</small> : null}
        {canAdd ? (
          <>
            <small className="ingredient-source-free">{t("Non è nel magazzino: costo e allergeni valgono solo per questa ricetta.")}</small>
            <button type="button" className="ingredient-add-catalog" onClick={onAddToCatalog}>{t("+ Aggiungi al magazzino")}</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
