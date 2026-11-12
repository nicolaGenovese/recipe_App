import { num } from "@/lib/num";
import type { StockItem } from "@/lib/types";

// Weight and volume share one scale because kitchens dose liquids by weight: 1 g counts as 1 ml.
// Imperial units use UK measures (pint 568 ml, fl oz 28.4 ml).
const UNIT_SCALE: Record<string, number> = {
  g: 1, kg: 1000, ml: 1, cl: 10, l: 1000, tsp: 5, tbsp: 15, oz: 28.3495, lb: 453.592, "fl oz": 28.4131, pint: 568.261
};
const UNIT_ALIASES: Record<string, string> = {
  gr: "g", lt: "l", pints: "pint", pinta: "pint", pinte: "pint", pt: "pint", pc: "pz", pcs: "pz", each: "pz",
  floz: "fl oz", "fl. oz": "fl oz", lbs: "lb", porzione: "porz", portion: "porz", portions: "porz"
};

/** Every unit the app knows, in the order shown in Settings. The kitchen picks which ones to offer. */
export const UNIT_CATALOG: { key: string; label: string; group: "metric" | "imperial" | "count" }[] = [
  { key: "g", label: "g · grammi", group: "metric" }, { key: "kg", label: "kg · chili", group: "metric" },
  { key: "ml", label: "ml · millilitri", group: "metric" }, { key: "cl", label: "cl · centilitri", group: "metric" }, { key: "l", label: "l · litri", group: "metric" },
  { key: "oz", label: "oz · once", group: "imperial" }, { key: "lb", label: "lb · libbre", group: "imperial" },
  { key: "fl oz", label: "fl oz · once liquide", group: "imperial" }, { key: "pint", label: "pint · pinte", group: "imperial" },
  { key: "tsp", label: "tsp · cucchiaino", group: "count" }, { key: "tbsp", label: "tbsp · cucchiaio", group: "count" },
  { key: "pz", label: "pz · pezzi", group: "count" }, { key: "porz", label: "porz · porzioni", group: "count" },
  { key: "mazzo", label: "mazzo · mazzi", group: "count" }, { key: "confezione", label: "confezione · confezioni", group: "count" }
];

export const DEFAULT_UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "pz", "porz"];

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
