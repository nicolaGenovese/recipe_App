"use client";

import { PlateIcon } from "@/components/ui/icons";
import { allergens, coverType, hasImage, portionCost, portionsOf } from "@/lib/recipes/math";
import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useRecipeActions } from "@/state/actions/useRecipeActions";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { data, onMenu, openDialog, f, t, fmt } = useApp();
  const menuCount = data.menus.filter((menu) => menu.active && menu.recipeIds.includes(recipe.id)).length;
  const guard = useGuard();
  const { cloneRecipe } = useRecipeActions();
  const image = hasImage(recipe) ? recipe.image : "";

  return (
    <article className="recipe-card">
      <div className={"card-cover cover-" + coverType(recipe) + (image ? " has-image" : "")}>
        {image ? <img src={image} alt="" loading="lazy" /> : <><span className="cover-art"><PlateIcon /></span><span className="cover-spot" /></>}
        <span className="cover-label">{t(recipe.category) || t("Ricetta")}</span>
        <div className="card-menu">
          {onMenu.has(recipe.id) ? <span className="card-flag">✓ {menuCount > 1 ? fmt(t("{0} menu"), menuCount) : t("In menu")}</span> : null}
          {recipe.archivedBatch ? <span className="card-flag">{t("Base")}</span> : null}
          <button className="card-more" type="button" onClick={() => openDialog({ kind: "recipeActions", id: recipe.id })} aria-label={t("Altre azioni")}>···</button>
        </div>
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span className={"category-tag" + (recipe.archivedBatch ? " batch" : "")}>{t(recipe.category) || t("Senza categoria")}</span>
          <span className="updated-label">{t("Aggiornata")} {f.dateLabel(recipe.updatedAt)}</span>
        </div>
        <button className="card-title" type="button" onClick={() => openDialog({ kind: "recipeDetail", id: recipe.id })}>{recipe.name}</button>
        <p className="card-description">{recipe.description || t("Aggiungi una breve descrizione per questa ricetta.")}</p>
        <div className="card-divider" />
        <div className="card-footer">
          <span className="card-stat">♙ {portionsOf(recipe)} {t("porzioni")}</span>
          <span className="card-stat">◇ {allergens(recipe).length} {t("allergeni")}</span>
          <span className="card-actions">
            <span className="card-cost">{f.money(portionCost(recipe))} <small>/ {t("porz.")}</small></span>
            <button className="card-action" type="button" onClick={guard(() => cloneRecipe(recipe.id))} aria-label={t("Duplica ricetta")}>⧉</button>
            <button className="card-action" type="button" onClick={() => openDialog({ kind: "recipeEditor", recipe })} aria-label={t("Modifica ricetta")}>↗</button>
          </span>
        </div>
      </div>
    </article>
  );
}
