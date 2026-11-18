"use client";

import { useRecipeRights } from "@/state/useRights";
import { AllergenTags, Callout, MetricTile } from "@/components/ui/bits";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { PlateIcon } from "@/components/ui/icons";
import { allergenStatus } from "@/lib/recipes/allergens";
import { calories, coverType, hasCost, hasImage, margin, portionCost, portionsOf, recipeCostGaps, totalCost } from "@/lib/recipes/math";
import { num } from "@/lib/num";
import type { Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { menusOfRecipe } from "@/lib/menus/menus";
import { countLabel } from "@/lib/i18n";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-block"><h4>{title}</h4>{children}</section>;
}

function Checks({ items }: { items?: string[] }) {
  const { t } = useApp();
  return items?.length
    ? <div className="check-pill-list">{items.map((item) => <div key={item} className="check-pill">{t(item)}</div>)}</div>
    : <p className="detail-text">{t("Nessuna voce selezionata.")}</p>;
}

function IngredientTable({ recipe }: { recipe: Recipe }) {
  const { f, t } = useApp();
  const list = recipe.ingredients || [];
  if (!list.length) return <p className="detail-text">{t("Nessun ingrediente inserito. Aggiungili dalla scheda di modifica.")}</p>;
  return (
    <table className="detail-table">
      <thead><tr><th>{t("Ingrediente")}</th><th>{t("Tipo")}</th><th>{t("Quantità")}</th><th className="cost-only">{t("Costo")}</th></tr></thead>
      <tbody>
        {list.map((item, index) => (
          <tr key={index}><td>{item.name}</td><td>{t(item.type) || t("Prodotto")}</td><td>{num(item.quantity)} {item.unit || ""}</td><td className="cost-only">{f.money(num(item.quantity) * num(item.unitCost))}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function RecipeDetailDialog({ id }: { id: string }) {
  const { data, gpRules, openDialog, f, t, fmt } = useApp();
  const rights = useRecipeRights();
  const recipe = data.recipes.find((item) => item.id === id);
  if (!recipe) return null;
  const gaps = recipeCostGaps(recipe);
  const kcal = calories(recipe);
  const allergenInfo = allergenStatus(recipe, data.stockItems, data.recipes);

  return (
    <Dialog>
      <DialogHeader kicker={t("SCHEDA RICETTA")} title={recipe.name} subtitle={recipe.description || t("Dettagli, ingredienti e indicazioni per la cucina.")} />
      <div className="detail-hero">
        <div className={"detail-photo cover-" + coverType(recipe)}>
          {hasImage(recipe) ? <img src={recipe.image} alt={t("Foto di") + " " + recipe.name} /> : <span className="cover-art"><PlateIcon /></span>}
        </div>
        <div className="detail-summary">
          <span className="category-tag">{t(recipe.category) || t("Senza categoria")}</span>
          <div className="detail-flags">
            {recipe.archivedBatch ? <span className="category-tag batch">{t("Base / preparazione")}</span> : null}
          </div>
          {menusOfRecipe(data.menus, recipe.id).length ? (
            <p className="detail-line"><strong>{t("Nei menu")}</strong> {menusOfRecipe(data.menus, recipe.id).map((menu) => menu.name + (menu.active ? "" : " (" + t("sospeso") + ")")).join(" · ")}</p>
          ) : <p className="detail-line muted">{t("In nessun menu")}</p>}
          <p className={"detail-line" + (recipe.cookingMethod ? "" : " muted")}><strong>{t("Tecnica")}</strong> {recipe.cookingMethod ? t(recipe.cookingMethod) : t("da definire")}</p>
          <div className="detail-mini-stat">
            <span>{countLabel(t, portionsOf(recipe), "porzione", "porzioni")}</span><span>{countLabel(t, (recipe.ingredients || []).length, "ingrediente", "ingredienti")}</span><span>{t("Aggiornata")} {f.dateLabel(recipe.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div className="detail-body">
        {gaps.length ? <Callout title={t("Costo incompleto")}>{fmt(t("Senza costo: {0}."), gaps.map((row) => row.name).join(", "))}</Callout> : null}
        <div className="pill-metrics cost-only">
          <MetricTile label={t("Costo totale")}>{f.money(totalCost(recipe))}</MetricTile>
          <MetricTile label={t("Costo / porzione")}>{f.money(portionCost(recipe))}</MetricTile>
          <MetricTile label={t("Prezzo vendita")}>{f.money(recipe.sellingPrice)}</MetricTile>
          <MetricTile label={t("Margine teorico")}>{hasCost(recipe) ? <>{margin(recipe, gpRules).toFixed(1)}<small>%</small></> : <span className="metric-missing" title={t("Gli ingredienti non hanno ancora un costo: il margine non si può calcolare.")}>{t("Costo mancante")}</span>}</MetricTile>
        </div>
        <div className="detail-two-col">
          <div>
            <Block title={t("Ingredienti")}><IngredientTable recipe={recipe} /></Block>
            <Block title={t("Metodo")}><p className="detail-text">{recipe.method || t("Metodo da aggiungere.")}</p></Block>
            <Block title={t("MEP / preparazione anticipata")}><p className="detail-text">{recipe.mep || t("Nessuna indicazione.")}</p></Block>
            <Block title={t("Impiattamento")}><p className="detail-text">{recipe.plating || t("Nessuna indicazione.")}</p></Block>
          </div>
          <div>
            <Block title={t("Allergeni")}>
              <AllergenTags items={allergenInfo.contains} empty={t("Nessun allergene indicato.")} />
              {allergenInfo.mayContain.length ? <p className="detail-text" style={{ marginTop: 6 }}>{t("Può contenere")}: {allergenInfo.mayContain.map(t).join(", ")}</p> : null}
              <p className={"allergen-state " + allergenInfo.state}>
                {allergenInfo.state === "ok" && allergenInfo.check ? fmt(t("Controllati il {0}"), f.dateLabel(allergenInfo.check.at)) + (allergenInfo.check.by ? " · " + allergenInfo.check.by : "")
                  : allergenInfo.state === "changed" ? t("Cambiati dall'ultimo controllo: da ricontrollare.")
                  : allergenInfo.state === "empty" ? t("Senza ingredienti: allergeni non noti.")
                  : t("Non ancora controllati.")}
              </p>
              <p className="detail-text" style={{ marginTop: 8 }}>{recipe.allergenGuidance || ""}</p>
            </Block>
            <Block title={t("Controlli di sicurezza")}><Checks items={recipe.ccpChecks} /></Block>
            <Block title={t("Preparazione e attrezzature")}><Checks items={recipe.prepChecks} /></Block>
            <Block title={t("Energia dagli ingredienti")}>
              <p className="detail-text">{Math.round(kcal).toLocaleString(f.locale)} kcal / {t("ricetta")} · {Math.round(kcal / portionsOf(recipe)).toLocaleString(f.locale)} kcal / {t("porzione")}</p>
            </Block>
            <Block title={t("Note nutrizionali")}><p className="detail-text">{recipe.nutritionInfo || t("Nessuna nota nutrizionale.")}</p></Block>
          </div>
        </div>
      </div>
      <footer className="dialog-footer">
        <div>
          <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "print", mode: "folder", recipeId: recipe.id })}>{t("Stampa scheda")}</button>
          <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "safetyCooking", recipeId: recipe.id })}>{t("Registra temperatura")}</button>
        </div>
        <div className="dialog-footer-right">
          {rights.canMenus ? <button className="button button-secondary button-small" type="button" onClick={() => openDialog({ kind: "recipeMenus", id: recipe.id })}>{t("Menu…")}</button> : null}
          {rights.canEdit(recipe) ? <button className="button button-primary button-small" type="button" onClick={() => openDialog({ kind: "recipeEditor", recipe })}>{t("Modifica ricetta")}</button> : null}
        </div>
      </footer>
    </Dialog>
  );
}
