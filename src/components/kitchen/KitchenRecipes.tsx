"use client";

import { useMemo, useState } from "react";
import { allergenStatus } from "@/lib/recipes/allergens";
import { BASE } from "@/lib/recipes/catalog";
import { hasImage, portionsOf } from "@/lib/recipes/math";
import { methodSteps, printQuantity, printScale, scaledRow } from "@/lib/recipes/print";
import { countLabel } from "@/lib/i18n";
import { num } from "@/lib/num";
import { unitText } from "@/lib/stock/units";
import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

type Scope = "menu" | "bases" | "all";

/** Free text as typed, one paragraph per line. */
function Lines({ text }: { text?: string }) {
  return <>{String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</>;
}

/**
 * One recipe as the cook needs it at the station: allergens first, the ingredients for the portions
 * chosen with large − and + keys, the method in numbered steps, then prep, plating and notes. No costs.
 */
function RecipeView({ recipe, onBack }: { recipe: Recipe; onBack: () => void }) {
  const { data, f, t, fmt } = useApp();
  const base = portionsOf(recipe);
  const [portions, setPortions] = useState(base);
  const scale = printScale(recipe, portions);
  const rows = (recipe.ingredients || []).map((row) => scaledRow(row, scale));
  const steps = methodSteps(recipe.method);
  const status = allergenStatus(recipe, data.stockItems, data.recipes);
  const checked = status.state === "ok";

  return (
    <article className="kitchen-recipe">
      <button type="button" className="kitchen-back kitchen-recipe-back" onClick={onBack}><span aria-hidden="true">←</span> {t("Tutte le ricette")}</button>
      <header className="kitchen-recipe-head">
        <div>
          {recipe.category ? <p className="kitchen-recipe-kicker">{t(recipe.category)}</p> : null}
          <h3>{recipe.name}</h3>
          {recipe.description ? <p className="kitchen-recipe-description">{recipe.description}</p> : null}
          <p className="kitchen-recipe-facts">
            {[recipe.cookingMethod ? t(recipe.cookingMethod) : "", recipe.shelfLifeDays ? fmt(t("Si conserva {0} giorni"), recipe.shelfLifeDays) : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        {hasImage(recipe) ? <img className="kitchen-recipe-photo" src={recipe.image} alt="" /> : null}
      </header>

      <section className={"kitchen-recipe-allergens" + (checked ? "" : " unchecked")} aria-label={t("Allergeni")}>
        <p><strong>{t("Allergeni")}:</strong> {status.contains.length ? status.contains.map(t).join(", ") : t("nessuno negli ingredienti registrati")}</p>
        {status.mayContain.length ? <p><strong>{t("Può contenere")}:</strong> {status.mayContain.map(t).join(", ")}</p> : null}
        {recipe.allergenGuidance ? <p>{recipe.allergenGuidance}</p> : null}
        {checked ? null : <p className="kitchen-recipe-verdict">⚠ {t("Non ancora controllati: verificali prima di servire.")}</p>}
      </section>

      <div className="kitchen-recipe-portions" role="group" aria-label={t("Porzioni")}>
        <button type="button" className="kitchen-sign" onClick={() => setPortions((value) => Math.max(1, value - 1))} aria-label={t("Una porzione in meno")} disabled={portions <= 1}>−</button>
        <strong>{countLabel(t, portions, "porzione", "porzioni")}</strong>
        <button type="button" className="kitchen-sign" onClick={() => setPortions((value) => value + 1)} aria-label={t("Una porzione in più")}>+</button>
        {portions !== base ? <button type="button" className="link-button" onClick={() => setPortions(base)}>{fmt(t("Torna a {0}"), base)}</button> : null}
      </div>

      <div className="kitchen-recipe-columns">
        <section className="kitchen-recipe-part">
          <h4>{t("Ingredienti")}</h4>
          {rows.length ? (
            <ul className="kitchen-recipe-ingredients">
              {rows.map((row, index) => (
                <li key={index}>
                  <span className="kitchen-recipe-qty">{num(row.quantity) ? printQuantity(row.quantity, f.locale) + " " + unitText(row.unit, t) : ""}</span>
                  <span>{row.name}{row.type === BASE ? <small> · {t("base")}</small> : null}</span>
                </li>
              ))}
            </ul>
          ) : <p>{t("Nessun ingrediente inserito.")}</p>}
        </section>
        <section className="kitchen-recipe-part">
          <h4>{t("Metodo")}</h4>
          {steps.length ? <ol className="kitchen-recipe-steps">{steps.map((step, index) => <li key={index}>{step}</li>)}</ol> : <p>{t("Metodo da aggiungere.")}</p>}
        </section>
      </div>

      {recipe.mep ? <section className="kitchen-recipe-part"><h4>{t("MEP / preparazione anticipata")}</h4><Lines text={recipe.mep} /></section> : null}
      {recipe.plating ? <section className="kitchen-recipe-part"><h4>{t("Impiattamento")}</h4><Lines text={recipe.plating} /></section> : null}
      {recipe.notes ? <section className="kitchen-recipe-part"><h4>{t("Note")}</h4><Lines text={recipe.notes} /></section> : null}
    </article>
  );
}

/**
 * Recipes to read at the station: a large search over names, categories and ingredients, the dishes
 * on the menus, the bases or everything, and one recipe at a time in a simple, large view.
 */
export function KitchenRecipes() {
  const { data, onMenu, t, fmt } = useApp();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(() => (onMenu.size ? "menu" : "all"));
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? data.recipes.find((recipe) => recipe.id === openId) : undefined;

  const needle = query.trim().toLocaleLowerCase();
  const list = useMemo(() => data.recipes
    .filter((recipe) => scope === "all" || (scope === "bases" ? recipe.archivedBatch : onMenu.has(recipe.id)))
    .filter((recipe) => !needle || [recipe.name, t(recipe.category), ...(recipe.ingredients || []).map((row) => row.name)].join(" ").toLocaleLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name)), [data.recipes, scope, needle, onMenu, t]);

  if (open) return <RecipeView key={open.id} recipe={open} onBack={() => { setOpenId(null); window.scrollTo(0, 0); }} />;

  const scopes: [Scope, string][] = [["menu", t("In menu")], ["bases", t("Basi")], ["all", t("Tutte")]];
  return (
    <div className="kitchen-recipes">
      <div className="kitchen-field">
        <label htmlFor="kitchenRecipeSearch">{t("Cerca una ricetta")}</label>
        <input id="kitchenRecipeSearch" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Nome, categoria o ingrediente")} autoComplete="off" />
      </div>
      <div className="kitchen-segment" role="group" aria-label={t("Quali ricette")}>
        {scopes.map(([value, label]) => <button key={value} type="button" className={scope === value ? "active" : ""} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}
      </div>
      <p className="kitchen-hint" aria-live="polite">{fmt(t(list.length === 1 ? "{0} ricetta" : "{0} ricette"), list.length)}</p>
      {list.length ? (
        <ul className="kitchen-recipe-list">
          {list.map((recipe) => {
            const status = allergenStatus(recipe, data.stockItems, data.recipes);
            return (
              <li key={recipe.id}>
                <button type="button" onClick={() => { setOpenId(recipe.id); window.scrollTo(0, 0); }}>
                  <span className="kitchen-recipe-list-main">
                    <strong>{recipe.name}</strong>
                    <small>{[t(recipe.category), status.contains.length ? status.contains.map(t).join(", ") : t("Nessun allergene indicato")].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="kitchen-recipe-list-go" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <div className="kitchen-empty">{t("Nessuna ricetta trovata.")}</div>}
    </div>
  );
}
