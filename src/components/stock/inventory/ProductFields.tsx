"use client";

import type { Dispatch, SetStateAction } from "react";
import { Datalist, FieldShell, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { AllergenPicker } from "@/components/ui/AllergenPicker";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { num } from "@/lib/num";
import { productCostPreview } from "@/lib/stock/preview";
import type { ProductForm } from "@/lib/stock/productForm";
import { MEASURE_LABELS, MEASUREMENTS } from "@/lib/stock/sources";
import { useApp } from "@/state/AppProvider";

/**
 * Live check of the product sheet: what one unit of sale contains, what a recipe unit costs and what
 * 100 g (or ml, or one piece) costs in a recipe, with a warning for set-ups that are almost surely wrong.
 */
function CostPreview({ form, onFix }: { form: ProductForm; onFix: (content: number) => void }) {
  const { f, t, fmt } = useApp();
  const preview = productCostPreview({ measurement: form.measurement, price: form.price, recipeContent: form.recipeContent, recipeUnit: form.recipeUnit });
  const unitOfSale = form.unitOfSale.trim() || t("unità di vendita");
  const bad = preview.warnings.some((warning) => warning.kind === "kiloAsGrams" || warning.kind === "tooExpensive");
  return (
    <div className={"product-preview" + (bad ? " bad" : "")} aria-live="polite">
      <strong>{t("Costo nelle ricette")}</strong>
      <span>
        {fmt(t("1 {0} = {1}, contiene {2} {3}"), unitOfSale, f.money(form.price), num(form.recipeContent) || 0, form.recipeUnit)}
        {" → "}{fmt(t("1 {0} = {1}"), form.recipeUnit, f.unitMoney(preview.perRecipeUnit))}
      </span>
      <span className="product-preview-main">
        {fmt(t("In ricetta: 1 {0} = {1} · {2} {0} = {3}"), preview.rowUnit, f.unitMoney(preview.perRowUnit), preview.sampleAmount, f.money(preview.sampleCost))}
      </span>
      {preview.warnings.map((warning) => {
        if (warning.kind === "kiloAsGrams") {
          return (
            <span key={warning.kind} className="product-preview-warning">
              {fmt(t("Attenzione: con Measurement a {0} e unità nelle ricette {1}, il contenuto di 1 {0} è {2} {1}, non {3}. Così 1 {1} costerebbe quanto 1 {0}."),
                warning.bigUnit, warning.smallUnit, warning.suggestedContent, num(form.recipeContent))}
              {" "}<button type="button" onClick={() => onFix(warning.suggestedContent)}>{fmt(t("Imposta contenuto {0}"), warning.suggestedContent)}</button>
            </span>
          );
        }
        if (warning.kind === "tooExpensive") {
          return <span key={warning.kind} className="product-preview-warning">{fmt(t("Attenzione: {0} al {1} è un prezzo molto alto. Controlla Contenuto e Unità nelle ricette."), f.money(warning.perKilo), warning.unit)}</span>;
        }
        if (warning.kind === "noContent") return <span key={warning.kind} className="product-preview-warning">{t("Il contenuto deve essere maggiore di zero.")}</span>;
        return <span key={warning.kind} className="field-hint">{t("Senza prezzo il prodotto costa zero nelle ricette.")}</span>;
      })}
    </div>
  );
}

interface Props {
  form: ProductForm;
  setForm: Dispatch<SetStateAction<ProductForm>>;
  /** Prefix for the field ids, so the sheet can sit inside another form without clashing ids. */
  idPrefix?: string;
  /** Inside another form, "required" would block that form's own submit. */
  nested?: boolean;
}

/** Every field of a stock product, shared by the product dialog and the recipe editor. */
export function ProductFields({ form, setForm, idPrefix = "field-", nested = false }: Props) {
  const { data, f, t } = useApp();
  const set = (key: keyof ProductForm) => (value: string) => setForm((old) => ({ ...old, [key]: value }));
  const id = (key: string) => idPrefix + key;
  const suppliers = Array.from(new Set(data.stockItems.map((row) => row.supplier).filter(Boolean)));
  const groups = Array.from(new Set(data.stockItems.map((row) => row.group).filter(Boolean)));

  return (
    <>
      <div className="form-grid">
        <TextField id={id("name")} label={t("Nome del prodotto *")} name="name" value={form.name} onChange={set("name")} required={!nested} wide />
        <TextField id={id("code")} label={t("Codice")} name="code" value={form.code} onChange={set("code")} hint={t("Se lo lasci vuoto viene assegnato in automatico.")} />
        <TextField id={id("parLevel")} label={t("Livello minimo")} name="parLevel" type="number" step="0.01" value={form.parLevel} onChange={set("parLevel")} hint={t("Sotto questa giacenza il prodotto va riordinato. 0 = nessun controllo.")} />
        <TextField id={id("supplier")} label={t("Fornitore")} name="supplier" value={form.supplier} onChange={set("supplier")} list={id("suppliers")} />
        <TextField id={id("group")} label={t("Reparto")} name="group" value={form.group} onChange={set("group")} list={id("groups")} />
        <SelectField id={id("measurement")} label={t("Misura")} name="measurement" value={form.measurement} onChange={set("measurement")}
          options={MEASUREMENTS.filter((value) => value !== "Portion").map((value) => ({ value, label: t(MEASURE_LABELS[value]) }))} />
        <TextField id={id("unitOfSale")} label={t("Unità di vendita")} name="unitOfSale" value={form.unitOfSale} onChange={set("unitOfSale")} placeholder={t("Es. cartone, kg, pz")} />
        <TextField id={id("price")} label={f.withCurrency(t("Prezzo per unità di vendita (€)"))} name="price" type="number" step="0.01" value={form.price} onChange={set("price")} />
        <TextField id={id("unitsPerPack")} label={t("Pezzi per confezione")} name="unitsPerPack" type="number" step="1" min={1} value={form.unitsPerPack} onChange={set("unitsPerPack")} hint={t("Solo per la misura Pezzo: il valore è pezzi ÷ pezzi per confezione × prezzo.")} />
        <TextField id={id("initialStock")} label={t("Giacenza iniziale")} name="initialStock" type="number" step="0.01" value={form.initialStock} onChange={set("initialStock")} hint={t("Usata finché non esiste un report inviato o un conteggio in Inventario.")} />
        <TextField id={id("recipeContent")} label={t("Contenuto per unità di vendita")} name="recipeContent" type="number" step="0.001" value={form.recipeContent} onChange={set("recipeContent")} hint={t("Es. un cartone da 10 kg = 10.")} />
        <FieldShell label={t("Unità nelle ricette")} htmlFor={id("recipeUnit")}><UnitSelect id={id("recipeUnit")} value={form.recipeUnit} onChange={set("recipeUnit")} /></FieldShell>
        <TextField id={id("kcal")} label={t("kcal per unità ricetta")} name="kcal" type="number" step="0.1" value={form.kcal} onChange={set("kcal")} />
        <CostPreview form={form} onFix={(content) => setForm((old) => ({ ...old, recipeContent: String(content) }))} />
        <FieldShell label={t("Allergeni")} htmlFor={id("allergens")} wide><AllergenPicker value={form.allergens} onChange={set("allergens")} /></FieldShell>
        <TextAreaField id={id("note")} label={t("Note")} name="note" value={form.note} onChange={set("note")} wide />
      </div>
      <Datalist id={id("suppliers")} values={suppliers} />
      <Datalist id={id("groups")} values={groups} />
    </>
  );
}
