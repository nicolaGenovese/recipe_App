"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { Datalist, FieldShell, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { AllergenPicker } from "@/components/ui/AllergenPicker";
import { recipesUsing } from "@/lib/recipes/catalog";
import { productCostPreview } from "@/lib/stock/preview";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { newId, num } from "@/lib/num";
import { MEASURE_LABELS, MEASUREMENTS } from "@/lib/stock/sources";
import type { StockItem } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

type Form = Record<"name" | "code" | "parLevel" | "supplier" | "group" | "measurement" | "unitOfSale" | "price" | "unitsPerPack" | "initialStock" | "recipeContent" | "recipeUnit" | "kcal" | "allergens" | "note", string>;

function toForm(item: Partial<StockItem>): Form {
  return {
    name: item.name ?? "", code: item.code ?? "", parLevel: String(item.parLevel || 0), supplier: item.supplier ?? "", group: item.group ?? "",
    measurement: item.measurement || "Pack", unitOfSale: item.unitOfSale ?? "", price: String(item.price || 0), unitsPerPack: String(item.unitsPerPack || 1),
    initialStock: String(item.initialStock || 0), recipeContent: String(item.recipeContent || 1), recipeUnit: item.recipeUnit || "kg",
    kcal: String(item.kcal || 0), allergens: (item.allergens || []).join(", "), note: item.note ?? ""
  };
}

/**
 * Live check of the product sheet: what one unit of sale contains, what a recipe unit costs and what
 * 100 g (or ml, or one piece) costs in a recipe, with a warning for set-ups that are almost surely wrong.
 */
function CostPreview({ form, onFix }: { form: Form; onFix: (content: number) => void }) {
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

/** Create or edit a stock product: price, measure and conversion to recipe units. */
export function StockItemDialog({ id }: { id?: string }) {
  const { data, closeDialog, notify, f, t, fmt } = useApp();
  const guard = useGuard();
  const { saveStockItem } = useStockActions();
  const existing = id ? data.stockItems.find((item) => item.id === id) : undefined;
  const isNew = !existing;
  const [form, setForm] = useState<Form>(() => toForm(existing ?? {}));
  const set = (key: keyof Form) => (value: string) => setForm((old) => ({ ...old, [key]: value }));
  const suppliers = Array.from(new Set(data.stockItems.map((row) => row.supplier).filter(Boolean)));
  const groups = Array.from(new Set(data.stockItems.map((row) => row.group).filter(Boolean)));

  const submit = guard(async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) { notify(t("Inserisci il nome del prodotto."), true); return; }
    await saveStockItem({
      id: existing?.id ?? newId(), code: form.code.trim(), parLevel: Math.max(0, num(form.parLevel)), name, supplier: form.supplier.trim(), group: form.group.trim(),
      measurement: form.measurement || "Pack", unitOfSale: form.unitOfSale.trim(), price: num(form.price), unitsPerPack: Math.max(1, num(form.unitsPerPack) || 1),
      initialStock: num(form.initialStock), recipeContent: num(form.recipeContent) || 1, recipeUnit: form.recipeUnit.trim() || "kg", kcal: num(form.kcal),
      allergens: form.allergens.split(",").map((value) => value.trim()).filter(Boolean), note: form.note.trim()
    }, isNew);
  });

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("PRODOTTO DI MAGAZZINO")} title={t(isNew ? "Nuovo prodotto" : "Modifica prodotto")} subtitle={t("Prezzo, misura e conversione verso le unità usate nelle ricette.")} />
      <form id="stockItemForm" onSubmit={submit}>
        <div className="dialog-body">
          <div className="form-grid">
            <TextField label={t("Nome del prodotto *")} name="name" value={form.name} onChange={set("name")} required wide />
            <TextField label={t("Codice")} name="code" value={form.code} onChange={set("code")} hint={t("Se lo lasci vuoto viene assegnato in automatico.")} />
            <TextField label={t("Livello minimo")} name="parLevel" type="number" step="0.01" value={form.parLevel} onChange={set("parLevel")} hint={t("Sotto questa giacenza il prodotto va riordinato. 0 = nessun controllo.")} />
            <TextField label={t("Fornitore")} name="supplier" value={form.supplier} onChange={set("supplier")} list="stockSuppliers" />
            <TextField label={t("Reparto")} name="group" value={form.group} onChange={set("group")} list="stockGroups" />
            <SelectField label={t("Misura")} name="measurement" value={form.measurement} onChange={set("measurement")}
              options={MEASUREMENTS.filter((value) => value !== "Portion").map((value) => ({ value, label: t(MEASURE_LABELS[value]) }))} />
            <TextField label={t("Unità di vendita")} name="unitOfSale" value={form.unitOfSale} onChange={set("unitOfSale")} placeholder={t("Es. cartone, kg, pz")} />
            <TextField label={f.withCurrency(t("Prezzo per unità di vendita (€)"))} name="price" type="number" step="0.01" value={form.price} onChange={set("price")} />
            <TextField label={t("Pezzi per confezione")} name="unitsPerPack" type="number" step="1" min={1} value={form.unitsPerPack} onChange={set("unitsPerPack")} hint={t("Solo per la misura Pezzo: il valore è pezzi ÷ pezzi per confezione × prezzo.")} />
            <TextField label={t("Giacenza iniziale")} name="initialStock" type="number" step="0.01" value={form.initialStock} onChange={set("initialStock")} hint={t("Usata finché non esiste un report inviato o un conteggio in Inventario.")} />
            <TextField label={t("Contenuto per unità di vendita")} name="recipeContent" type="number" step="0.001" value={form.recipeContent} onChange={set("recipeContent")} hint={t("Es. un cartone da 10 kg = 10.")} />
            <FieldShell label={t("Unità nelle ricette")} htmlFor="field-recipeUnit"><UnitSelect id="field-recipeUnit" value={form.recipeUnit} onChange={set("recipeUnit")} /></FieldShell>
            <TextField label={t("kcal per unità ricetta")} name="kcal" type="number" step="0.1" value={form.kcal} onChange={set("kcal")} />
            <CostPreview form={form} onFix={(content) => setForm((old) => ({ ...old, recipeContent: String(content) }))} />
            <FieldShell label={t("Allergeni")} htmlFor="field-allergens" wide><AllergenPicker value={form.allergens} onChange={set("allergens")} /></FieldShell>
            <TextAreaField label={t("Note")} name="note" value={form.note} onChange={set("note")} wide />
          </div>
          {existing ? (() => {
            const users = recipesUsing(existing.id, data.recipes);
            return (
              <div className="product-usage">
                <strong>{fmt(t("Usato in {0} ricette"), users.length)}</strong>
                <span>{users.length ? users.map((recipe) => recipe.name).join(", ") : t("Non è ancora in nessuna ricetta.")}</span>
                {users.length ? <small className="field-hint">{t("Prezzo, allergeni e kcal salvati qui si aggiornano da soli in queste ricette.")}</small> : null}
              </div>
            );
          })() : null}
          <Datalist id="stockSuppliers" values={suppliers} />
          <Datalist id="stockGroups" values={groups} />
        </div>
        <footer className="dialog-footer">
          <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
          <button className="button button-primary" type="submit">{t(isNew ? "Crea prodotto" : "Salva modifiche")}</button>
        </footer>
      </form>
    </Dialog>
  );
}
