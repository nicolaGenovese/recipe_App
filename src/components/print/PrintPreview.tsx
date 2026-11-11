"use client";

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
    return (
      <div className="preview-sheet">
        <h3>{title}</h3>
        <p>{menuName} · {fmt(t("{0} ricette"), recipes.length)}</p>
        <table className="detail-table matrix-table">
          <thead><tr><th>{t("Allergene")}</th>{recipes.map((recipe) => <th key={recipe.id}>{recipe.name}</th>)}</tr></thead>
          <tbody>
            {(data.settings.allergens || []).map((allergen) => (
              <tr key={allergen}><th>{t(allergen)}</th>{recipes.map((recipe) => <td key={recipe.id}>{allergens(recipe).includes(allergen) ? "●" : "—"}</td>)}</tr>
            ))}
          </tbody>
        </table>
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
      return <div key={recipe.id} className="preview-recipe"><div>{heading}<small>{t(recipe.category)}</small></div><span className="preview-allergens">{tags.map(t).join(" · ") || t("Nessun allergene indicato")}</span></div>;
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
