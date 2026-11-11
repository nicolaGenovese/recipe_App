import { num, round2 } from "@/lib/num";
import { portionCost } from "@/lib/recipes/math";
import { ingredientUnitCost } from "@/lib/stock/units";
import type { Recipe, StockItem, WasteLog, WasteReason } from "@/lib/types";

export const WASTE_REASONS: WasteReason[] = ["expired", "error", "leftover", "damaged", "other"];

/** Cost of one unit of what is thrown away: product price per unit, recipe cost per portion, or nothing for free entries. */
export function wasteUnitCost(source: WasteLog["source"], itemId: string | undefined, unit: string, recipes: Recipe[], stockItems: StockItem[]): number | null {
  if (source === "recipe") {
    const recipe = recipes.find((row) => row.id === itemId);
    return recipe ? Math.round(portionCost(recipe) * 10000) / 10000 : null;
  }
  if (source === "product") {
    const item = stockItems.find((row) => row.id === itemId);
    return item ? ingredientUnitCost(item, unit || item.recipeUnit) : null;
  }
  return null;
}

export const wasteCost = (log: Pick<WasteLog, "quantity" | "unitCost">) => round2(num(log.quantity) * num(log.unitCost));

export function wasteBetween(logs: WasteLog[], from: string, to: string): WasteLog[] {
  return logs.filter((log) => log.date >= from && log.date <= to).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export interface WasteTotals {
  total: number;
  byReason: Record<WasteReason, number>;
  /** Most expensive items first. */
  byItem: { name: string; cost: number; count: number }[];
}

export function wasteTotals(logs: WasteLog[]): WasteTotals {
  const byReason = Object.fromEntries(WASTE_REASONS.map((reason) => [reason, 0])) as Record<WasteReason, number>;
  const items = new Map<string, { name: string; cost: number; count: number }>();
  for (const log of logs) {
    const cost = wasteCost(log);
    byReason[log.reason] = round2((byReason[log.reason] ?? 0) + cost);
    const key = log.name.trim().toLocaleLowerCase();
    const row = items.get(key) ?? { name: log.name, cost: 0, count: 0 };
    row.cost = round2(row.cost + cost);
    row.count += 1;
    items.set(key, row);
  }
  const total = round2(Object.values(byReason).reduce((sum, value) => sum + value, 0));
  return { total, byReason, byItem: Array.from(items.values()).sort((a, b) => b.cost - a.cost) };
}
