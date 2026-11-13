import { num } from "@/lib/num";
import { allergens, calories, portionCost, portionsOf } from "@/lib/recipes/math";
import { BATCH_SUPPLIER } from "@/lib/stock/report";
import type { Ingredient, Recipe, StockItem, StockSource } from "@/lib/types";

/** Products plus base recipes, which are counted in portions as internal batch preparations. */
export function stockSources(stockItems: StockItem[], recipes: Recipe[]): StockSource[] {
  const batches: StockSource[] = recipes.filter((recipe) => recipe.archivedBatch).map((recipe) => ({
    id: "recipe:" + recipe.id, name: recipe.name, supplier: BATCH_SUPPLIER, group: "", measurement: "Portion", unitOfSale: "porzione",
    unitsPerPack: 1, price: Math.round(portionCost(recipe) * 100) / 100, recipeContent: 1, recipeUnit: "porz",
    allergens: allergens(recipe), kcal: calories(recipe) / portionsOf(recipe), initialStock: 0, batch: true
  }));
  return stockItems.map((item) => ({ ...item, batch: false })).concat(batches);
}

/** Cost of one recipe unit straight from the product price, before any unit conversion. */
export function sourceUnitCost(source: Pick<StockItem, "price" | "recipeContent">): number {
  return Math.round((num(source.price) / (num(source.recipeContent) || 1)) * 10000) / 10000;
}

/** An ingredient row prefilled from a product or base recipe. */
export function ingredientFromSource(source: StockSource, quantity = 0): Ingredient {
  return {
    type: source.batch ? "Base / preparazione" : "Prodotto", name: source.name, supplier: source.batch ? "" : source.supplier || "",
    quantity, unit: source.recipeUnit, unitCost: sourceUnitCost(source), allergens: source.allergens || [], kcal: num(source.kcal), stockItemId: source.id
  };
}

export function findStockItemByName(stockItems: StockItem[], name: string): StockItem | null {
  const key = name.trim().toLocaleLowerCase();
  return stockItems.find((item) => item.name.trim().toLocaleLowerCase() === key) || null;
}

export const MEASURE_LABELS: Record<string, string> = { Pack: "Confezione", Each: "Pezzo", Kilo: "Kg", Litre: "Litro", Portion: "Porzione" };
export const MEASUREMENTS = ["Pack", "Each", "Kilo", "Litre", "Portion"] as const;
