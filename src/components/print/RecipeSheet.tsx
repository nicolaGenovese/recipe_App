"use client";

import { allergenStatus } from "@/lib/recipes/allergens";
import { BASE } from "@/lib/recipes/catalog";
import { hasCost, hasImage, margin, portionsOf, totalCost } from "@/lib/recipes/math";
import { methodSteps, printQuantity, printScale, scaledRow } from "@/lib/recipes/print";
import { countLabel } from "@/lib/i18n";
import { num } from "@/lib/num";
import { unitText } from "@/lib/stock/units";
import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

/** A titled part of the sheet; nothing is printed when it has no content. */
function Part({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={"sheet-part " + className}><h4>{title}</h4>{children}</section>;
}

/** Free text kept as the cook typed it, one paragraph per line. */
function Lines({ text }: { text?: string }) {
  return <>{String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</>;
}

/**
 * One recipe on one page, for the kitchen wall or folder: allergens first, then the ingredients for
 * the portions chosen, the method in numbered steps, and the rest of what the recipe says. Costs are
 * printed only when asked for.
 */
export function RecipeSheet({ recipe, portions, costs, image }: { recipe: Recipe; portions?: number; costs: boolean; image: boolean }) {
  const { data, gpRules, f, t, fmt } = useApp();
  const base = portionsOf(recipe);
  const target = portions && portions > 0 ? portions : base;
  const scale = printScale(recipe, target);
  const rows = (recipe.ingredients || []).map((row) => scaledRow(row, scale));
  const steps = methodSteps(recipe.method);
  const status = allergenStatus(recipe, data.stockItems, data.recipes);
  const checks = [...(recipe.ccpChecks || []), ...(recipe.prepChecks || [])];
  const facts = [
    countLabel(t, target, "porzione", "porzioni") + (scale !== 1 ? " (" + fmt(t("ricetta da {0}"), base) + ")" : ""),
    recipe.cookingMethod ? t(recipe.cookingMethod) : "",
    recipe.shelfLifeDays ? fmt(t("Si conserva {0} giorni"), recipe.shelfLifeDays) : ""
  ].filter(Boolean);
  const verdict = status.state === "ok" && status.check
    ? "✓ " + fmt(t("Controllati il {0}"), f.dateLabel(status.check.at)) + (status.check.by ? " · " + status.check.by : "")
    : "⚠ " + t(status.state === "changed" ? "Cambiati dall'ultimo controllo: da ricontrollare." : status.state === "empty" ? "Senza ingredienti: allergeni non noti." : "Non ancora controllati: verificali prima di servire.");

  return (
    <article className="recipe-sheet">
      <header className="sheet-head">
        <div>
          {recipe.category ? <p className="sheet-kicker">{t(recipe.category)}</p> : null}
          <h3>{recipe.name}</h3>
          {recipe.description ? <p className="sheet-description">{recipe.description}</p> : null}
          <p className="sheet-facts">{facts.join(" · ")}</p>
        </div>
        {image && hasImage(recipe) ? <img className="sheet-photo" src={recipe.image} alt="" /> : null}
      </header>

      <section className={"sheet-allergens" + (status.state === "ok" ? "" : " unchecked")} aria-label={t("Allergeni")}>
        <p><strong>{t("Allergeni")}:</strong> {status.contains.length ? status.contains.map(t).join(", ") : t("nessuno negli ingredienti registrati")}</p>
        {status.mayContain.length ? <p><strong>{t("Può contenere")}:</strong> {status.mayContain.map(t).join(", ")}</p> : null}
        {recipe.allergenGuidance ? <p>{recipe.allergenGuidance}</p> : null}
        <p className="sheet-verdict">{verdict}</p>
      </section>

      <div className="sheet-columns">
        <Part title={scale !== 1 ? fmt(t("Ingredienti per {0}"), countLabel(t, target, "porzione", "porzioni")) : t("Ingredienti")} className="sheet-ingredients">
          {rows.length ? (
            <table>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="sheet-qty">{num(row.quantity) ? printQuantity(row.quantity, f.locale) + " " + unitText(row.unit, t) : ""}</td>
                    <td>{row.name}{row.type === BASE ? <small> · {t("base")}</small> : null}</td>
                    {costs ? <td className="sheet-cost">{f.money(num(row.quantity) * num(row.unitCost))}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>{t("Nessun ingrediente inserito.")}</p>}
        </Part>
        <Part title={t("Metodo")} className="sheet-method">
          {steps.length ? <ol>{steps.map((step, index) => <li key={index}>{step}</li>)}</ol> : <p>{t("Metodo da aggiungere.")}</p>}
        </Part>
      </div>

      {recipe.mep ? <Part title={t("MEP / preparazione anticipata")}><Lines text={recipe.mep} /></Part> : null}
      {recipe.plating ? <Part title={t("Impiattamento")}><Lines text={recipe.plating} /></Part> : null}
      {checks.length ? <Part title={t("Controlli")}><ul className="sheet-checks">{checks.map((item) => <li key={item}>{t(item)}</li>)}</ul></Part> : null}
      {recipe.notes ? <Part title={t("Note")}><Lines text={recipe.notes} /></Part> : null}
      {costs ? (
        <Part title={t("Costi")} className="sheet-costs">
          <p>
            {t("Costo totale")} {f.money(totalCost({ ingredients: rows }))} · {t("Costo / porzione")} {f.money(totalCost(recipe) / base)}
            {num(recipe.sellingPrice) ? " · " + t("Prezzo vendita") + " " + f.money(recipe.sellingPrice) : ""}
            {num(recipe.sellingPrice) && hasCost(recipe) ? " · " + t("Margine teorico") + " " + margin(recipe, gpRules).toFixed(1) + "%" : ""}
          </p>
        </Part>
      ) : null}

      <footer className="sheet-foot">{fmt(t("Stampata il {0}"), f.longToday())} · {t("aggiornata il")} {f.dateLabel(recipe.updatedAt)}</footer>
    </article>
  );
}
