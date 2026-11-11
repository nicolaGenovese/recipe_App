"use client";

import { useMemo, useState } from "react";
import { MetricTile } from "@/components/ui/bits";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill } from "@/components/ui/Field";
import { num } from "@/lib/num";
import { availableInRecipeUnits, maxBatches } from "@/lib/stock/inventory";
import { ingredientFromSource, stockSources } from "@/lib/stock/sources";
import { useApp } from "@/state/AppProvider";

interface Pick { checked: boolean; quantity: string }

/** Pick products in stock with quantities, see the cost and how many batches stock allows, then open the editor. */
export function RecipePickerDialog() {
  const { data, openDialog, closeDialog, notify, f, t, fmt } = useApp();
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [portions, setPortions] = useState("4");
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const rows = useMemo(() => stockSources(data.stockItems, data.recipes).sort((a, b) => a.name.localeCompare(b.name)).map((source) => ({
    source,
    available: availableInRecipeUnits(source, data.stockReports, data.stockDeliveries),
    cost: num(source.price) / (num(source.recipeContent) || 1),
    search: [source.name, source.supplier, source.group].join(" ").toLocaleLowerCase()
  })), [data]);

  const pick = (id: string) => picks[id] ?? { checked: false, quantity: "" };
  const setPick = (id: string, change: Partial<Pick>) => setPicks((old) => ({ ...old, [id]: { ...pick(id), ...change } }));
  const selected = rows.filter((row) => pick(row.source.id).checked).map((row) => ({ ...row, quantity: num(pick(row.source.id).quantity) }));
  const allSet = selected.length > 0 && selected.every((row) => row.quantity > 0);
  const servings = Math.max(1, num(portions) || 1);

  function next() {
    if (!selected.length) { notify(t("Seleziona almeno un ingrediente."), true); return; }
    if (selected.some((row) => row.quantity <= 0)) { notify(t("Inserisci la quantità di ogni ingrediente selezionato."), true); return; }
    closeDialog();
    openDialog({ kind: "recipeEditor", recipe: { portions: servings, ingredients: selected.map((row) => ingredientFromSource(row.source, row.quantity)) } });
  }

  const needle = query.trim().toLocaleLowerCase();
  return (
    <Dialog>
      <DialogHeader kicker={t("RICETTA DAL MAGAZZINO")} title={t("Scegli gli ingredienti")} subtitle={t("Seleziona i prodotti in giacenza e indica la quantità per una ricetta.")} />
      <div className="dialog-body">
        <div className="stock-toolbar">
          <input type="search" value={query} placeholder={t("Cerca nel magazzino…")} aria-label={t("Cerca nel magazzino…")} onChange={(event) => setQuery(event.target.value)} />
          <CheckPill checked={onlyAvailable} onChange={setOnlyAvailable}>{t("Solo disponibili")}</CheckPill>
          <div className="form-field stock-pick-portions">
            <label htmlFor="stockPickPortions">{t("Porzioni")}</label>
            <input id="stockPickPortions" type="number" min="1" step="1" value={portions} onChange={(event) => setPortions(event.target.value)} />
          </div>
        </div>
        <div className="stock-pick-head"><span /><span>{t("Prodotto")}</span><span>{t("Disponibile")}</span><span>{t("Costo / unità")}</span><span>{t("Quantità in ricetta")}</span></div>
        <div className="stock-pick-list">
          {rows.map(({ source, available, cost, search }) => {
            const state = pick(source.id);
            // Selected rows stay visible even when the search no longer matches them.
            const visible = state.checked || (search.includes(needle) && (!onlyAvailable || available > 0));
            if (!visible) return null;
            return (
              <div key={source.id} className="stock-pick-row">
                <input type="checkbox" checked={state.checked} aria-label={fmt(t("Seleziona {0}"), source.name)} onChange={(event) => setPick(source.id, { checked: event.target.checked })} />
                <div><strong>{source.name}</strong><small>{t(source.supplier) || "—"}</small></div>
                <span>{f.quantity(available)} {source.recipeUnit}</span>
                <span>{f.money(cost)}</span>
                <span className="stock-pick-qty">
                  <input type="number" min="0" step="0.001" value={state.quantity} aria-label={t("Quantità in ricetta") + " · " + source.name}
                    className={state.checked && num(state.quantity) > available ? "stock-over" : ""}
                    onChange={(event) => setPick(source.id, { quantity: event.target.value, ...(num(event.target.value) > 0 ? { checked: true } : {}) })} />
                  <small>{source.recipeUnit}</small>
                </span>
              </div>
            );
          })}
        </div>
        <div className="pill-metrics stock-pick-metrics">
          <MetricTile label={t("Selezionati")}>{selected.length}</MetricTile>
          <MetricTile label={t("Costo ricetta")}>{f.money(selected.reduce((total, row) => total + row.quantity * row.cost, 0))}</MetricTile>
          <MetricTile label={t("Porzioni producibili")}>{allSet ? maxBatches(selected) * servings : 0}</MetricTile>
        </div>
      </div>
      <footer className="dialog-footer">
        <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
        <button className="button button-primary" type="button" onClick={next}>{t("Continua")}</button>
      </footer>
    </Dialog>
  );
}
