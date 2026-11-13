import { newId, num } from "@/lib/num";
import type { GpRules, Ingredient, Recipe, StockSource } from "@/lib/types";
import { sourceUnitCost } from "@/lib/stock/sources";
import { convertQuantity, recipeUnitFor, unitFactor } from "@/lib/stock/units";

// The editor keeps numbers as text while typing, so an empty field stays empty instead of jumping to 0.

export interface IngredientDraft {
  key: string;
  type: string;
  name: string;
  supplier: string;
  quantity: string;
  unit: string;
  unitCost: string;
  allergens: string;
  kcal: string;
  stockItemId: string;
}

export interface RecipeForm {
  id: string;
  name: string;
  category: string;
  portions: string;
  creator: string;
  cookingMethod: string;
  description: string;
  /** Menus the dish is on. They are saved on the menus, not on the recipe. */
  menuIds: string[];
  archivedBatch: boolean;
  /** Days the batch keeps, as typed; empty means the kitchen default. */
  shelfLifeDays: string;
  image: string;
  mep: string;
  method: string;
  plating: string;
  nutritionInfo: string;
  allergenGuidance: string;
  sellingPrice: string;
  vat: string;
  marginTarget: string;
  ccpChecks: string[];
  prepChecks: string[];
  ingredients: IngredientDraft[];
}

export const INGREDIENT_TYPES = ["Prodotto", "Base / preparazione", "Esterno"];

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));
const numberText = (value: unknown) => (num(value) ? String(num(value)) : "");

export function ingredientDraft(row: Partial<Ingredient> = {}): IngredientDraft {
  return {
    key: newId(), type: row.type || "Prodotto", name: text(row.name), supplier: text(row.supplier), quantity: numberText(row.quantity),
    unit: row.unit || "g", unitCost: numberText(row.unitCost), allergens: (row.allergens || []).join(", "), kcal: numberText(row.kcal), stockItemId: text(row.stockItemId)
  };
}

export function ingredientFromDraft(row: IngredientDraft): Ingredient {
  return {
    type: row.type, name: row.name.trim(), supplier: row.supplier.trim(), quantity: num(row.quantity), unit: row.unit || "pz", unitCost: num(row.unitCost),
    allergens: row.allergens.split(",").map((value) => value.trim()).filter(Boolean), kcal: num(row.kcal), stockItemId: row.stockItemId
  };
}

/** Typing a product or base name fills the row from it; typing anything else unlinks the row. */
export function matchIngredient(row: IngredientDraft, sources: StockSource[]): IngredientDraft {
  const name = row.name.trim().toLocaleLowerCase();
  const source = sources.find((item) => item.name.toLocaleLowerCase() === name);
  if (!source) return row.stockItemId ? { ...row, stockItemId: "" } : row;
  if (row.stockItemId === source.id) return row;
  // Products counted in kg or l are used in g or ml.
  const unit = recipeUnitFor(source.recipeUnit);
  const perUnit = unitFactor(unit, source.recipeUnit) ?? 1;
  return {
    ...row, stockItemId: source.id, type: source.batch ? "Base / preparazione" : "Prodotto", supplier: source.batch ? "" : source.supplier || "",
    unit, unitCost: String(Math.round(sourceUnitCost(source) * perUnit * 1e6) / 1e6), allergens: (source.allergens || []).join(", "),
    kcal: numberText(Math.round(num(source.kcal) * perUnit * 1e4) / 1e4)
  };
}

/**
 * Changing the unit keeps the same amount: 0.09 kg becomes 90 g. A row's own cost and kcal per unit
 * move the other way. Units that cannot convert (g to pz) only change the label.
 */
export function changeUnit(row: IngredientDraft, unit: string): IngredientDraft {
  const quantity = convertQuantity(num(row.quantity), row.unit, unit);
  const factor = unitFactor(row.unit, unit);
  if (quantity === null || !factor) return { ...row, unit };
  return {
    ...row, unit, quantity: row.quantity.trim() === "" ? "" : String(quantity),
    unitCost: row.unitCost.trim() === "" ? "" : String(Math.round((num(row.unitCost) / factor) * 1e6) / 1e6),
    kcal: row.kcal.trim() === "" ? "" : String(Math.round((num(row.kcal) / factor) * 1e4) / 1e4)
  };
}

export function toForm(recipe: Partial<Recipe>, defaults: { category: string; cookingMethod: string; creator: string; rules: GpRules; menuIds?: string[] }): RecipeForm {
  return {
    id: recipe.id || "", name: text(recipe.name), category: recipe.category || defaults.category, portions: String(recipe.portions || 2),
    creator: recipe.creator || defaults.creator, cookingMethod: recipe.cookingMethod || defaults.cookingMethod, description: text(recipe.description),
    menuIds: defaults.menuIds ?? [], shelfLifeDays: recipe.shelfLifeDays ? String(recipe.shelfLifeDays) : "", archivedBatch: Boolean(recipe.archivedBatch), image: text(recipe.image),
    mep: text(recipe.mep), method: text(recipe.method), plating: text(recipe.plating), nutritionInfo: text(recipe.nutritionInfo), allergenGuidance: text(recipe.allergenGuidance),
    sellingPrice: String(recipe.sellingPrice || 0), vat: String(recipe.vat ?? defaults.rules.defaultVat), marginTarget: String(recipe.marginTarget ?? defaults.rules.defaultMarginTarget),
    ccpChecks: recipe.ccpChecks || [], prepChecks: recipe.prepChecks || [], ingredients: (recipe.ingredients || []).map(ingredientDraft)
  };
}

/** The recipe to save: the old record with the edited fields on top, so unknown fields survive. */
export function fromForm(form: RecipeForm, old: Recipe | undefined): Recipe {
  const now = new Date().toISOString();
  // The old single-menu flag is dropped on save: menus now hold their own dishes.
  const { currentMenu: _legacy, ...rest } = old || ({} as Partial<Recipe>);
  return {
    ...rest, id: form.id || newId(), name: form.name.trim(), category: form.category || "Senza categoria", description: form.description.trim(),
    portions: Math.max(1, num(form.portions) || 1), shelfLifeDays: form.shelfLifeDays.trim() ? Math.max(0, Math.round(num(form.shelfLifeDays))) : undefined, archivedBatch: form.archivedBatch, creator: form.creator,
    image: form.image, cookingMethod: form.cookingMethod, ingredients: form.ingredients.map(ingredientFromDraft).filter((row) => row.name),
    sellingPrice: num(form.sellingPrice), marginTarget: num(form.marginTarget), vat: num(form.vat), allergenGuidance: form.allergenGuidance,
    mep: form.mep, method: form.method, plating: form.plating, nutritionInfo: form.nutritionInfo, ccpChecks: form.ccpChecks, prepChecks: form.prepChecks,
    createdAt: old?.createdAt || now, updatedAt: now
  };
}
