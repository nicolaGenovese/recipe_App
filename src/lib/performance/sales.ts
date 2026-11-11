import { num, round2 } from "@/lib/num";
import { portionCost } from "@/lib/recipes/math";
import type { GpRules, Recipe, SalesLine, SalesWeek } from "@/lib/types";

type VatRules = Pick<GpRules, "defaultVat">;

/** VAT rate of a dish: its own, or the kitchen default. */
const vatOf = (recipe: Recipe | undefined, rules: VatRules) => num(recipe?.vat ?? rules.defaultVat);

/** Takings of a line without VAT: what the till says, or quantity × menu price. */
export function lineNetRevenue(line: SalesLine, recipe: Recipe | undefined, rules: VatRules): number {
  const gross = line.revenue !== null && line.revenue !== undefined ? num(line.revenue) : num(line.quantity) * num(recipe?.sellingPrice);
  return round2(gross / (1 + vatOf(recipe, rules) / 100));
}

/** Food cost of a line in theory: quantity × cost per portion of the recipe. */
export function lineCost(line: SalesLine, recipe: Recipe | undefined): number {
  return recipe ? round2(num(line.quantity) * portionCost(recipe)) : 0;
}

export interface SalesTotals {
  dishes: number;
  /** Net sales: the till figure when entered, otherwise the lines added up. */
  netSales: number;
  linesNet: number;
  theoreticalCost: number;
  /** GP the recipes should give at these sales: (net − cost) ÷ net. */
  theoreticalGp: number | null;
  unmatched: string[];
}

export function salesTotals(week: Pick<SalesWeek, "lines" | "netSales"> | undefined, recipes: Recipe[], rules: VatRules): SalesTotals {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const lines = week?.lines ?? [];
  let linesNet = 0;
  let theoreticalCost = 0;
  let dishes = 0;
  for (const line of lines) {
    const recipe = line.recipeId ? byId.get(line.recipeId) : undefined;
    linesNet += lineNetRevenue(line, recipe, rules);
    theoreticalCost += lineCost(line, recipe);
    dishes += num(line.quantity);
  }
  linesNet = round2(linesNet);
  theoreticalCost = round2(theoreticalCost);
  const netSales = week?.netSales !== null && week?.netSales !== undefined && num(week.netSales) > 0 ? num(week.netSales) : linesNet;
  return {
    dishes, netSales, linesNet, theoreticalCost,
    theoreticalGp: linesNet > 0 ? ((linesNet - theoreticalCost) / linesNet) * 100 : null,
    unmatched: lines.filter((line) => !line.recipeId || !byId.has(line.recipeId)).map((line) => line.name)
  };
}

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export interface DishAnalysis {
  recipeId: string;
  name: string;
  sold: number;
  /** Share of all dishes sold, in %. */
  mix: number;
  netPrice: number;
  cost: number;
  /** Net price minus cost: what each dish leaves. */
  margin: number;
  totalMargin: number;
  popular: boolean;
  profitable: boolean;
  kind: MenuClass;
}

/**
 * Menu engineering (Kasavana–Smith): a dish is popular when it sells at least 70% of an equal
 * share, and profitable when its margin is at least the average margin weighted by sales.
 */
export function analyseMenu(weeks: Pick<SalesWeek, "lines">[], recipes: Recipe[], rules: VatRules, onlyIds?: string[]): DishAnalysis[] {
  const sold = new Map<string, number>();
  for (const week of weeks) for (const line of week.lines) {
    if (line.recipeId) sold.set(line.recipeId, (sold.get(line.recipeId) ?? 0) + num(line.quantity));
  }
  const ids = onlyIds ?? Array.from(sold.keys());
  const rows = ids.map((id) => recipes.find((recipe) => recipe.id === id)).filter((recipe): recipe is Recipe => Boolean(recipe)).map((recipe) => {
    const netPrice = round2(num(recipe.sellingPrice) / (1 + vatOf(recipe, rules) / 100));
    const cost = round2(portionCost(recipe));
    const count = sold.get(recipe.id) ?? 0;
    return { recipeId: recipe.id, name: recipe.name, sold: count, netPrice, cost, margin: round2(netPrice - cost), totalMargin: round2((netPrice - cost) * count) };
  });
  const totalSold = rows.reduce((sum, row) => sum + row.sold, 0);
  const popularLine = rows.length ? (1 / rows.length) * 0.7 * 100 : 0;
  const averageMargin = totalSold ? rows.reduce((sum, row) => sum + row.totalMargin, 0) / totalSold : 0;
  return rows.map((row) => {
    const mix = totalSold ? (row.sold / totalSold) * 100 : 0;
    const popular = totalSold > 0 && mix >= popularLine;
    const profitable = row.margin >= averageMargin;
    const kind: MenuClass = popular ? (profitable ? "star" : "plowhorse") : profitable ? "puzzle" : "dog";
    return { ...row, mix, popular, profitable, kind };
  }).sort((a, b) => b.totalMargin - a.totalMargin);
}

/** Portions to plan for one day of service: average daily sales of the recent weeks, rounded up. */
export function suggestedPortions(weeks: SalesWeek[], recipeId: string, lastWeeks = 4): number {
  const recent = [...weeks].sort((a, b) => b.id.localeCompare(a.id)).slice(0, lastWeeks).filter((week) => week.lines.some((line) => line.recipeId));
  if (!recent.length) return 0;
  const total = recent.reduce((sum, week) => sum + week.lines.filter((line) => line.recipeId === recipeId).reduce((acc, line) => acc + num(line.quantity), 0), 0);
  return Math.ceil(total / (recent.length * 7));
}

/**
 * Reads a till export: one dish per line with name and quantity, and optionally the takings.
 * Commas, semicolons or tabs separate the columns; a header line and empty lines are skipped.
 */
export function parseSalesCsv(text: string, recipes: Recipe[]): SalesLine[] {
  const key = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const byName = new Map(recipes.filter((recipe) => !recipe.archivedBatch).map((recipe) => [key(recipe.name), recipe.id]));
  const lines: SalesLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const cells = raw.split(/[;\t]|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "").trim());
    if (cells.length < 2 || !cells[0]) continue;
    const quantity = Number(cells[1].replace(",", "."));
    if (!Number.isFinite(quantity)) continue;
    const revenue = cells[2] !== undefined && cells[2] !== "" ? Number(cells[2].replace(/[^\d.,-]/g, "").replace(",", ".")) : null;
    const name = cells[0];
    const recipeId = byName.get(key(name));
    const existing = lines.find((line) => (recipeId ? line.recipeId === recipeId : key(line.name) === key(name)));
    if (existing) {
      existing.quantity += quantity;
      if (revenue !== null && Number.isFinite(revenue)) existing.revenue = num(existing.revenue) + revenue;
    } else {
      lines.push({ ...(recipeId ? { recipeId } : {}), name, quantity, revenue: revenue !== null && Number.isFinite(revenue) ? revenue : null });
    }
  }
  return lines;
}
