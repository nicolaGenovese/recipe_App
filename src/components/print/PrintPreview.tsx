"use client";

import { allergenStatus, matrixColumns } from "@/lib/recipes/allergens";
import { allergens, hasImage, portionCost, portionsOf } from "@/lib/recipes/math";
import { num } from "@/lib/num";
import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import type { PrintMode } from "@/state/dialogs";

export const PRINT_TITLES: Record<PrintMode, string> = { recipes: "Ricette menu", allergens: "Allergeni", matrix: "Matrice allergeni", folder: "Schede cucina", till: "Prezzi menu" };

function Photo({ recipe, show }: { recipe: Recipe; show: boolean }) {
  return show && hasImage(recipe) ? <img src={recipe.image} alt="" style={{ maxWidth: 55, maxHeight: 38, objectFit: "cover", float: "right" }} /> : null;
}

/** The sheet that gets printed, in one of five layouts. */
export function PrintPreview({ mode, recipes, images, single, menuName }: { mode: PrintMode; recipes: Recipe[]; images: boolean; single: boolean; menuName: string }) {
  const { data, f, t, fmt } = useApp();
  const title = t(PRINT_TITLES[mode]);

  if (mode === "matrix") {
    // One row per dish in menu order, one column per allergen: easy to read at the pass and for guests.
    const columns = matrixColumns(data.settings.allergens || [], recipes);
    const statuses = new Map(recipes.map((recipe) => [recipe.id, allergenStatus(recipe, data.stockItems, data.recipes)]));
    const toCheck = recipes.filter((recipe) => statuses.get(recipe.id)?.state !== "ok");
    return (
      <div className="preview-sheet allergen-sheet">
        <h3>{title}</h3>
        <p>{single ? t("Scheda singola") : menuName} · {fmt(t("{0} piatti"), recipes.length)} · {f.longToday()}</p>
        {recipes.length ? (
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-dish">{t("Piatto")}</th>
                {columns.map((allergen) => <th key={allergen} className="matrix-col"><span>{t(allergen)}</span></th>)}
                <th className="matrix-check">{t("Controllo")}</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => {
                const status = statuses.get(recipe.id)!;
                return (
                  <tr key={recipe.id} className={status.state === "ok" ? "" : "unchecked"}>
                    <th className="matrix-dish">{recipe.name}<small>{t(recipe.category)}</small></th>
                    {columns.map((allergen) => (
                      <td key={allergen} className={status.contains.includes(allergen) ? "has" : status.mayContain.includes(allergen) ? "may" : ""}>
                        {status.contains.includes(allergen) ? "●" : status.mayContain.includes(allergen) ? "○" : ""}
                      </td>
                    ))}
                    <td className="matrix-check">
                      {status.state === "ok" && status.check ? "✓ " + f.dateLabel(status.check.at) : status.state === "changed" ? t("da ricontrollare") : t("da controllare")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p>{t("Nessuna ricetta in questo menu.")}</p>}
        <p className="matrix-legend">{t("● contiene · ○ può contenere (tracce) · vuoto: non presente negli ingredienti registrati")}</p>
        {toCheck.length ? <p className="matrix-warning">{fmt(t("Attenzione: allergeni non controllati per {0}. Controllali nella scheda del piatto (Cucina & allergeni) prima di esporre la matrice."), toCheck.map((recipe) => recipe.name).join(", "))}</p> : null}
        <p className="matrix-legend">{t("Se avete allergie o intolleranze chiedete al personale prima di ordinare.")}</p>
      </div>
    );
  }

  const row = (recipe: Recipe) => {
    const tags = allergens(recipe);
    const heading = <strong><Photo recipe={recipe} show={images} />{recipe.name}</strong>;
    if (mode === "till") {
      return <div key={recipe.id} className="preview-recipe"><div>{heading}<small>{t(recipe.category)} · {portionsOf(recipe)} {t("porzioni")}</small></div><strong>{f.money(recipe.sellingPrice)}</strong></div>;
    }
    if (mode === "allergens") {
      const status = allergenStatus(recipe, data.stockItems, data.recipes);
      return (
        <div key={recipe.id} className="preview-recipe">
          <div>{heading}<small>{t(recipe.category)}{status.state === "ok" ? "" : " · " + t(status.state === "changed" ? "da ricontrollare" : "da controllare")}</small></div>
          <span className="preview-allergens">
            {status.contains.map(t).join(" · ") || t("Nessun allergene indicato")}
            {status.mayContain.length ? <small>{t("Può contenere")}: {status.mayContain.map(t).join(", ")}</small> : null}
          </span>
        </div>
      );
    }
    const ingredients = (recipe.ingredients || []).map((item) => item.name + " · " + num(item.quantity) + " " + (item.unit || "")).join(" / ") || t("Ingredienti da completare");
    return (
      <div key={recipe.id} className="preview-recipe">
        <div>
          {heading}
          <small>{t(recipe.category)} · {portionsOf(recipe)} {t("porzioni")} · {f.money(portionCost(recipe))} / {t("porz.")}</small>
          <small>{ingredients}</small>
          {mode === "folder" ? <>
            <small>{recipe.method || t("Metodo da completare")}</small>
            <small>{t("Allergeni")}: {tags.map(t).join(", ") || t("non indicati")} · {t("Costo porzione")}: {f.money(portionCost(recipe))}</small>
          </> : null}
        </div>
        {mode === "recipes" ? <span>{f.money(recipe.sellingPrice)}</span> : null}
      </div>
    );
  };

  return (
    <div className="preview-sheet">
      <h3>{title}</h3>
      <p>{single ? t("Scheda singola") : menuName} · {fmt(t("{0} ricette"), recipes.length)} · {f.longToday()}</p>
      {recipes.length ? recipes.map(row) : <p>{t("Nessuna ricetta in questo menu.")}</p>}
    </div>
  );
}
