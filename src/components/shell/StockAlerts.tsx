"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellIcon } from "@/components/ui/icons";
import { allergenStatus } from "@/lib/recipes/allergens";
import { allergensToFill, missingIngredients, recipesUsing } from "@/lib/recipes/catalog";
import { productFormFromRow, productFromForm } from "@/lib/stock/productForm";
import { useApp } from "@/state/AppProvider";
import { useRecipeRights } from "@/state/useRights";

/**
 * The bell at the top right. Allergens first: dishes whose allergens changed after the kitchen
 * confirmed them, and products whose allergens nobody has checked on the label. Then ingredients
 * written by hand in recipes and missing from the stock. Each list shows only to whoever can fix it.
 */
export function StockAlerts() {
  const { data, openDialog, t, fmt, can } = useApp();
  const rights = useRecipeRights();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const missing = useMemo(() => (rights.canCreate || can("stock.manage") ? missingIngredients(data.recipes, data.stockItems) : []), [data.recipes, data.stockItems, rights.canCreate, can]);
  const toReconfirm = useMemo(() => data.recipes
    .filter((recipe) => rights.canEdit(recipe))
    .map((recipe) => ({ recipe, status: allergenStatus(recipe, data.stockItems, data.recipes) }))
    .filter((row) => row.status.state === "changed")
    .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name)), [data.recipes, data.stockItems, rights]);
  const toFill = useMemo(() => (can("stock.manage") ? data.stockItems.filter(allergensToFill) : [])
    .map((item) => ({ item, recipes: recipesUsing(item.id, data.recipes) }))
    .sort((a, b) => b.recipes.length - a.recipes.length || a.item.name.localeCompare(b.item.name)), [data.stockItems, data.recipes, can]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const total = toReconfirm.length + toFill.length + missing.length;
  const label = total ? fmt(t(total === 1 ? "{0} avviso" : "{0} avvisi"), total) : t("Nessun avviso");
  const openRecipe = (id: string, tab: "ingredients" | "kitchen") => { setOpen(false); openDialog({ kind: "recipeEditor", recipe: { id }, tab }); };
  const recipeLinks = (recipes: { id: string; name: string }[], tab: "ingredients" | "kitchen") => recipes.map((recipe, index) => (
    <span key={recipe.id}>{index ? ", " : null}<button type="button" className="link-button" onClick={() => openRecipe(recipe.id, tab)}>{recipe.name}</button></span>
  ));

  return (
    <div className="stock-alerts" ref={box}>
      <button className={"topbar-icon" + (total ? " has-alerts" : "")} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label} title={label}>
        <BellIcon />
        {total ? <span className="alert-badge">{total > 99 ? "99+" : total}</span> : null}
      </button>
      {open ? (
        <div className="alerts-panel" role="dialog" aria-label={t("Avvisi")}>
          {!total ? <p className="alerts-empty">{t("Nessun avviso: allergeni confermati e ingredienti tutti nel magazzino.")}</p> : null}

          {toReconfirm.length ? (
            <section className="alerts-group urgent">
              <div className="alerts-head">
                <strong>{t("Allergeni da riconfermare")} <span className="alerts-count">{toReconfirm.length}</span></strong>
                <small>{t("Piatti confermati in passato i cui allergeni sono cambiati, per esempio perché un prodotto ha cambiato etichetta.")}</small>
              </div>
              <ul className="alerts-list">
                {toReconfirm.map(({ recipe, status }) => (
                  <li key={recipe.id}>
                    <div className="alerts-item-top">
                      <button type="button" className="link-button alerts-name" onClick={() => openRecipe(recipe.id, "kitchen")}>{recipe.name}</button>
                      <button type="button" className="ingredient-add-catalog" onClick={() => openRecipe(recipe.id, "kitchen")}>{t("Ricontrolla")}</button>
                    </div>
                    <span className="alerts-recipes">
                      {[status.added.length ? fmt(t("aggiunti: {0}"), status.added.map(t).join(", ")) : "", status.removed.length ? fmt(t("tolti: {0}"), status.removed.map(t).join(", ")) : ""].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {toFill.length ? (
            <section className="alerts-group urgent">
              <div className="alerts-head">
                <strong>{t("Allergeni da controllare sull'etichetta")} <span className="alerts-count">{toFill.length}</span></strong>
                <small>{t("Prodotti nuovi o mai controllati: finché non li spunti, i piatti che li usano non si possono confermare.")}</small>
              </div>
              <ul className="alerts-list">
                {toFill.map(({ item, recipes }) => (
                  <li key={item.id}>
                    <div className="alerts-item-top">
                      <strong>{item.name}</strong>
                      <button type="button" className="ingredient-add-catalog" onClick={() => { setOpen(false); openDialog({ kind: "stockItem", id: item.id }); }}>{t("Controlla")}</button>
                    </div>
                    <span className="alerts-recipes">{recipes.length ? <>{t("In:")} {recipeLinks(recipes, "kitchen")}</> : t("Non ancora usato nelle ricette.")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {missing.length ? (
            <section className="alerts-group">
              <div className="alerts-head">
                <strong>{t("Prodotti non in magazzino")} <span className="alerts-count">{missing.length}</span></strong>
                <small>{t("Ingredienti scritti a mano nelle ricette: costo e allergeni non seguono il magazzino finché non li aggiungi, e i piatti non si possono confermare.")}</small>
              </div>
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
                    <span className="alerts-recipes">{t("In:")} {recipeLinks(item.recipes, "ingredients")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
