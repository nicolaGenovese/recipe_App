"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { ProductFields } from "@/components/stock/inventory/ProductFields";
import { recipesUsing } from "@/lib/recipes/catalog";
import { newId } from "@/lib/num";
import { productForm, productFromForm, type ProductForm } from "@/lib/stock/productForm";
import type { StockItem } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

/** Create or edit a stock product: price, measure and conversion to recipe units. A preset fills a new one. */
export function StockItemDialog({ id, preset }: { id?: string; preset?: Partial<StockItem> }) {
  const { data, closeDialog, notify, t, fmt } = useApp();
  const guard = useGuard();
  const { saveStockItem } = useStockActions();
  const existing = id ? data.stockItems.find((item) => item.id === id) : undefined;
  const isNew = !existing;
  const [form, setForm] = useState<ProductForm>(() => productForm(existing ?? preset ?? {}));

  const submit = guard(async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { notify(t("Inserisci il nome del prodotto."), true); return; }
    await saveStockItem(productFromForm(form, existing?.id ?? newId()), isNew);
  });

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("PRODOTTO DI MAGAZZINO")} title={t(isNew ? "Nuovo prodotto" : "Modifica prodotto")} subtitle={t("Prezzo, misura e conversione verso le unità usate nelle ricette.")} />
      <form id="stockItemForm" onSubmit={submit}>
        <div className="dialog-body">
          <ProductFields form={form} setForm={setForm} />
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
        </div>
        <footer className="dialog-footer">
          <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
          <button className="button button-primary" type="submit">{t(isNew ? "Crea prodotto" : "Salva modifiche")}</button>
        </footer>
      </form>
    </Dialog>
  );
}
