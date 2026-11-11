import { clamp, num } from "@/lib/num";
import type { GpRules, Ingredient, Recipe } from "@/lib/types";

type CostRow = Pick<Ingredient, "quantity" | "unitCost">;

export function totalCost(recipe: { ingredients?: CostRow[] }): number {
  return (recipe.ingredients || []).reduce((total, row) => total + num(row.quantity) * num(row.unitCost), 0);
}
export function portionsOf(recipe: { portions?: number }): number {
  return Math.max(1, num(recipe.portions) || 1);
}
export function portionCost(recipe: { ingredients?: CostRow[]; portions?: number }): number {
  return totalCost(recipe) / portionsOf(recipe);
}
export function allergens(recipe: { ingredients?: Pick<Ingredient, "allergens">[] }): string[] {
  return Array.from(new Set((recipe.ingredients || []).flatMap((row) => row.allergens || []).filter(Boolean)));
}
export function calories(recipe: { ingredients?: Pick<Ingredient, "quantity" | "kcal">[] }): number {
  return (recipe.ingredients || []).reduce((total, row) => total + num(row.quantity) * num(row.kcal), 0);
}

type MarginRules = Pick<GpRules, "recipeMarginOnNet">;

/** The price the margin is measured on: net of VAT or as entered, depending on the settings. */
export function recipeNetPrice(price: unknown, vat: unknown, rules: MarginRules): number {
  return rules.recipeMarginOnNet ? num(price) / (1 + num(vat) / 100) : num(price);
}

export interface PriceInput {
  sellingPrice: number;
  vat?: number;
  marginTarget?: number;
}

export function margin(recipe: PriceInput & { ingredients?: CostRow[]; portions?: number }, rules: MarginRules): number {
  const net = recipeNetPrice(recipe.sellingPrice, recipe.vat, rules);
  return net > 0 ? ((net - portionCost(recipe)) / net) * 100 : 0;
}

export function suggestPrice(recipe: PriceInput & { ingredients?: CostRow[]; portions?: number }, rules: MarginRules): number {
  const target = clamp(num(recipe.marginTarget), 0, 95) / 100;
  return (portionCost(recipe) / (1 - target)) * (rules.recipeMarginOnNet ? 1 + num(recipe.vat) / 100 : 1);
}

/** Lines that have a quantity but no cost; water is free, so it never counts as missing. */
export function recipeCostGaps(recipe: Pick<Recipe, "ingredients">): Ingredient[] {
  return (recipe.ingredients || []).filter((row) => num(row.quantity) > 0 && num(row.unitCost) <= 0 && !/^(water|acqua)\b/i.test(row.name || ""));
}

const COVERS = ["citrus", "spice", "herb", "berry", "bread", "sea", "night", "peach"];
/** A stable cover colour for recipes without a photo. */
export function coverType(recipe: Pick<Recipe, "category" | "name">): string {
  const value = (recipe.category || "") + (recipe.name || "");
  return COVERS[[...value].reduce((total, char) => total + char.charCodeAt(0), 0) % COVERS.length];
}

export function hasImage(recipe: Pick<Recipe, "image">): recipe is Recipe & { image: string } {
  return typeof recipe.image === "string" && recipe.image.startsWith("data:image/");
}
