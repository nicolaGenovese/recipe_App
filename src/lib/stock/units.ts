import { num } from "@/lib/num";
import type { StockItem } from "@/lib/types";

// Weight and volume share one scale because kitchens dose liquids by weight: 1 g counts as 1 ml.
const UNIT_SCALE: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000, tsp: 5, tbsp: 15 };
const UNIT_ALIASES: Record<string, string> = { gr: "g", lt: "l", pints: "pint", pinta: "pint", pinte: "pint", pc: "pz", pcs: "pz", each: "pz" };

function unitKey(unit: unknown): string {
  const key = String(unit || "").trim().toLowerCase().replace(/\.$/, "");
  return UNIT_ALIASES[key] || key;
}

/** How many `to` units fit in one `from` unit, or null when the two cannot convert. */
export function unitFactor(from: unknown, to: unknown): number | null {
  const a = unitKey(from);
  const b = unitKey(to);
  if (!a || !b) return null;
  if (a === b) return 1;
  return UNIT_SCALE[a] && UNIT_SCALE[b] ? UNIT_SCALE[a] / UNIT_SCALE[b] : null;
}

/** Cost of one recipe unit, or null when the product has no price or the units cannot convert. */
export function ingredientUnitCost(item: Pick<StockItem, "price" | "recipeContent" | "recipeUnit">, unit: string): number | null {
  const factor = unitFactor(unit, item.recipeUnit);
  if (num(item.price) <= 0 || factor === null) return null;
  return Math.round((num(item.price) / (num(item.recipeContent) || 1)) * factor * 1e6) / 1e6;
}

/** Stock counted in single pieces ("Each") is priced per pack, so it converts first. */
export function toSaleUnits(row: { measurement: string; unitsPerPack?: number }, quantity: unknown): number {
  return row.measurement === "Each" ? num(quantity) / Math.max(1, num(row.unitsPerPack) || 1) : num(quantity);
}

/** Invoices count sale units (packs), while "Each" stock is counted in single pieces. */
export function toStockUnits(row: { measurement: string; unitsPerPack?: number }, quantity: unknown): number {
  return row.measurement === "Each" ? num(quantity) * Math.max(1, num(row.unitsPerPack) || 1) : num(quantity);
}
