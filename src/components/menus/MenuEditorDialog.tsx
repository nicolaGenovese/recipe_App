"use client";

import { useState } from "react";
import { MetricTile } from "@/components/ui/bits";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill, TextField } from "@/components/ui/Field";
import { menuDishes, menuStats } from "@/lib/menus/menus";
import { newId } from "@/lib/num";
import { margin, portionCost } from "@/lib/recipes/math";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useMenuActions } from "@/state/actions/useMenuActions";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

/** Create or edit a menu: name, status and the dishes in serving order. */
export function MenuEditorDialog({ id }: { id?: string }) {
  const { data, gpRules, closeDialog, notify, f, t, fmt } = useApp();
  const guard = useGuard();
  const { saveMenu, deleteMenu } = useMenuActions();
  const { saveRecipe } = useRecipeActions();
  const base = id ? data.menus.find((menu) => menu.id === id) : undefined;

  const [name, setName] = useState(base?.name ?? "");
  const [description, setDescription] = useState(base?.description ?? "");
  const [active, setActive] = useState(base?.active ?? true);
  // Ids of deleted recipes are dropped as soon as the menu is opened.
  const [recipeIds, setRecipeIds] = useState(() => menuDishes(base ?? { recipeIds: [] }, data.recipes).map((recipe) => recipe.id));
  const [query, setQuery] = useState("");
  const [showBases, setShowBases] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRecipe, setNewRecipe] = useState("");

  const dishes = menuDishes({ recipeIds }, data.recipes);
  const stats = menuStats({ recipeIds }, data.recipes, gpRules);
  const search = query.trim().toLocaleLowerCase();
  const available = data.recipes
    .filter((recipe) => !recipeIds.includes(recipe.id) && (showBases || !recipe.archivedBatch))
    .filter((recipe) => !search || (recipe.name + " " + recipe.category).toLocaleLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Typing a name that no recipe has offers to create it.
  const exact = data.recipes.find((recipe) => recipe.name.trim().toLocaleLowerCase() === search);

  /**
   * Creates a recipe with just a name, saved at once and put on this menu. Ingredients, price and
   * method are added later from the recipe; the menu shows it as "no price" until then.
   */
  const createRecipe = guard(async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    const same = data.recipes.find((recipe) => recipe.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    const recipe = same ?? await saveRecipe({
      id: newId(), name, category: data.settings.categories[0] || "Senza categoria", portions: 1, archivedBatch: false, sellingPrice: 0,
      vat: gpRules.defaultVat, marginTarget: gpRules.defaultMarginTarget, ingredients: [], creator: t("Team cucina")
    });
    setRecipeIds((old) => (old.includes(recipe.id) ? old : [...old, recipe.id]));
    if (!same) notify(fmt(t("Ricetta “{0}” creata e aggiunta al menu. Completala dalla pagina Ricette."), recipe.name));
    setAdding(false);
    setNewRecipe("");
    setQuery("");
  });

  const move = (index: number, step: number) => setRecipeIds((old) => {
    const next = [...old];
    const [row] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(next.length, index + step)), 0, row);
    return next;
  });

  const submit = guard(() => saveMenu({ id: base?.id, name, description, active, recipeIds }));

  return (
    <Dialog size="wide">
      <DialogHeader kicker={t("MENU")} title={t(base ? "Modifica menu" : "Nuovo menu")} subtitle={t("Ogni menu ha i suoi piatti; lo stesso piatto può stare in più menu.")} />
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="dialog-body">
          <div className="form-grid">
            <TextField label={t("Nome del menu *")} name="menuName" value={name} onChange={setName} placeholder={t("Es. Pizza menu, Sunday roast")} required />
            <TextField label={t("Descrizione")} name="menuDescription" value={description} onChange={setDescription} placeholder={t("Es. Solo domenica a pranzo")} />
          </div>
          <CheckPill checked={active} onChange={setActive}>{t("Menu attivo: i suoi piatti contano come “in menu”")}</CheckPill>

          <div className="pill-metrics menu-editor-metrics">
            <MetricTile label={t("Piatti")}>{stats.dishes}</MetricTile>
            <MetricTile label={t("Costo medio")}>{f.money(stats.averageCost)}</MetricTile>
            <MetricTile label={t("Food cost")}>{stats.foodCostPercent ? stats.foodCostPercent.toFixed(1) + "%" : "—"}</MetricTile>
            <MetricTile label={t("Margine medio")}>{stats.dishes > stats.unpriced ? stats.averageMargin.toFixed(1) + "%" : "—"}</MetricTile>
          </div>

          <div className="menu-editor">
            <section className="menu-editor-pane">
              <h4>{t("Ricette disponibili")}</h4>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Cerca ricette…")} aria-label={t("Cerca ricette…")} />
              <CheckPill checked={showBases} onChange={setShowBases} className="menu-show-bases">{t("Mostra anche le basi")}</CheckPill>
              {adding ? (
                <span className="menu-quick-add">
                  <input autoFocus value={newRecipe} placeholder={t("Nome della nuova ricetta")} aria-label={t("Nome della nuova ricetta")}
                    onChange={(event) => setNewRecipe(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter creates the recipe, not the menu.
                      if (event.key === "Enter") { event.preventDefault(); void createRecipe(newRecipe); }
                      if (event.key === "Escape") { event.preventDefault(); setAdding(false); setNewRecipe(""); }
                    }} />
                  <button type="button" className="button button-primary button-small" disabled={!newRecipe.trim()} onClick={() => createRecipe(newRecipe)}>{t("Crea")}</button>
                  <button type="button" className="button button-quiet button-small" onClick={() => { setAdding(false); setNewRecipe(""); }}>{t("Annulla")}</button>
                </span>
              ) : (
                <button type="button" className="menu-quick-new" onClick={() => { setAdding(true); setNewRecipe(query.trim()); }}>{t("+ Nuova ricetta")}</button>
              )}
              <ul className="menu-pick">
                {search && !exact && !adding ? (
                  <li>
                    <button type="button" className="menu-pick-create" onClick={() => createRecipe(query)}>
                      <span>{fmt(t("Crea la ricetta “{0}”"), query.trim())}<small>{t("Solo il nome: il resto lo completi dopo")}</small></span><span aria-hidden="true">＋</span>
                    </button>
                  </li>
                ) : null}
                {available.map((recipe) => (
                  <li key={recipe.id}>
                    <button type="button" onClick={() => setRecipeIds((old) => [...old, recipe.id])}>
                      <span>{recipe.name}<small>{t(recipe.category)}</small></span><span aria-hidden="true">＋</span>
                    </button>
                  </li>
                ))}
                {available.length || search ? null : <li className="field-hint">{t("Nessuna ricetta da aggiungere.")}</li>}
              </ul>
            </section>
            <section className="menu-editor-pane">
              <h4>{fmt(t("Nel menu ({0})"), dishes.length)}</h4>
              <ol className="menu-order">
                {dishes.map((dish, index) => (
                  <li key={dish.id}>
                    <span className="menu-order-name">{dish.name}<small>{f.money(portionCost(dish))} → {dish.sellingPrice ? f.money(dish.sellingPrice) : t("senza prezzo")}{dish.sellingPrice ? " · " + margin(dish, gpRules).toFixed(0) + "%" : ""}</small></span>
                    <span className="menu-order-tools">
                      <button className="card-action" type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("Sposta su")}>↑</button>
                      <button className="card-action" type="button" disabled={index === dishes.length - 1} onClick={() => move(index, 1)} aria-label={t("Sposta giù")}>↓</button>
                      <button className="card-action" type="button" onClick={() => setRecipeIds((old) => old.filter((other) => other !== dish.id))} aria-label={t("Rimuovi")}>×</button>
                    </span>
                  </li>
                ))}
                {dishes.length ? null : <li className="field-hint">{t("Scegli i piatti dall'elenco a sinistra.")}</li>}
              </ol>
            </section>
          </div>
        </div>
        <footer className="dialog-footer">
          <div>{base ? <button className="button button-quiet" type="button" onClick={guard(() => deleteMenu(base.id))}>{t("Elimina menu")}</button> : <span />}</div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
            <button className="button button-primary" type="submit">{t(base ? "Salva menu" : "Crea menu")}</button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
