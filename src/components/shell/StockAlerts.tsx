"use client";

import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/ui/icons";
import { missingIngredients } from "@/lib/recipes/catalog";
import { productFormFromRow, productFromForm } from "@/lib/stock/productForm";
import { useApp } from "@/state/AppProvider";

/**
 * The bell at the top right: ingredients written in recipes that are not in the stock yet.
 * Recipes can be saved with them, but their cost and allergens do not follow the stock.
 */
export function StockAlerts() {
  const { data, openDialog, t, fmt } = useApp();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const missing = missingIngredients(data.recipes, data.stockItems);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const label = missing.length ? fmt(t("{0} ingredienti non nel magazzino"), missing.length) : t("Nessun avviso");
  return (
    <div className="stock-alerts" ref={box}>
      <button className={"topbar-icon" + (missing.length ? " has-alerts" : "")} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label} title={label}>
        <BellIcon />
        {missing.length ? <span className="alert-badge">{missing.length > 99 ? "99+" : missing.length}</span> : null}
      </button>
      {open ? (
        <div className="alerts-panel" role="dialog" aria-label={t("Avvisi")}>
          <div className="alerts-head">
            <strong>{t("Prodotti non in magazzino")}</strong>
            <small>{t("Ingredienti scritti a mano nelle ricette: costo e allergeni non seguono il magazzino finché non li aggiungi.")}</small>
          </div>
          {missing.length ? (
            <ul className="alerts-list">
              {missing.map((item) => (
                <li key={item.name.toLocaleLowerCase()}>
                  <div className="alerts-item-top">
                    <strong>{item.name}</strong>
                    <button type="button" className="ingredient-add-catalog" onClick={() => {
                      setOpen(false);
                      const { id: _id, ...preset } = productFromForm(productFormFromRow(item.row), "");
                      openDialog({ kind: "stockItem", preset });
                    }}>{t("+ Aggiungi al magazzino")}</button>
                  </div>
                  <span className="alerts-recipes">
                    {t("In:")}{" "}
                    {item.recipes.map((recipe, index) => (
                      <span key={recipe.id}>
                        {index ? ", " : null}
                        <button type="button" className="link-button" onClick={() => { setOpen(false); openDialog({ kind: "recipeEditor", recipe: { id: recipe.id }, tab: "ingredients" }); }}>{recipe.name}</button>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="alerts-empty">{t("Tutti gli ingredienti delle ricette sono nel magazzino.")}</p>}
        </div>
      ) : null}
    </div>
  );
}
