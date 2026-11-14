"use client";

import { useState, type KeyboardEvent } from "react";
import { ProductFields } from "@/components/stock/inventory/ProductFields";
import { newId } from "@/lib/num";
import { productFormFromRow, productFromForm, type ProductForm } from "@/lib/stock/productForm";
import type { Ingredient, StockItem } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

interface Props {
  row: Ingredient;
  onCreate: (product: StockItem) => Promise<void>;
  onCancel: () => void;
}

/**
 * The full product sheet opened under a recipe row that is not in stock. Only one dialog can be
 * open, so the sheet sits inside the recipe editor; it is not a form of its own, because forms
 * cannot be nested, and Enter creates the product instead of saving the recipe.
 */
export function NewProductPanel({ row, onCreate, onCancel }: Props) {
  const { notify, t } = useApp();
  const [form, setForm] = useState<ProductForm>(() => productFormFromRow(row));
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy) return;
    if (!form.name.trim()) { notify(t("Inserisci il nome del prodotto."), true); return; }
    setBusy(true);
    try { await onCreate(productFromForm(form, newId())); } catch (error) {
      notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true);
      setBusy(false);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") { event.preventDefault(); void create(); }
  };

  return (
    <div className="new-product-panel" role="group" aria-label={t("Nuovo prodotto di magazzino")} onKeyDown={onKeyDown}>
      <div className="new-product-head">
        <strong>{t("Nuovo prodotto di magazzino")}</strong>
        <small className="field-hint">{t("Compila la scheda come in Food Stock → Inventario: la riga verrà collegata al prodotto.")}</small>
      </div>
      <ProductFields form={form} setForm={setForm} idPrefix={"np-" + row.name.replace(/\W+/g, "") + "-"} nested />
      <div className="new-product-actions">
        <button className="button button-quiet" type="button" onClick={onCancel}>{t("Annulla")}</button>
        <button className="button button-primary" type="button" onClick={() => void create()} disabled={busy}>{busy ? t("Salvataggio…") : t("Crea prodotto e collega")}</button>
      </div>
    </div>
  );
}
