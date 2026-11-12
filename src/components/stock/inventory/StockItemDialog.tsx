"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { Datalist, FieldShell, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { AllergenPicker } from "@/components/ui/AllergenPicker";
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

/** Create or edit a stock product: price, measure and conversion to recipe units. */
export function StockItemDialog({ id }: { id?: string }) {
  const { data, closeDialog, notify, f, t } = useApp();
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
            <FieldShell label={t("Allergeni")} htmlFor="field-allergens" wide><AllergenPicker value={form.allergens} onChange={set("allergens")} /></FieldShell>
            <TextAreaField label={t("Note")} name="note" value={form.note} onChange={set("note")} wide />
          </div>
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
