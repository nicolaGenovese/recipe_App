import { round2 } from "@/lib/num";
import { dishKey, matchesAny, resolveRecipe } from "@/lib/orders/orders";
import type { OrdersConfig, PosSalesRow } from "@/lib/orders/types";
import type { Recipe, SalesLine, SalesWeek } from "@/lib/types";

/**
 * Weeks of sales from the till receipts, added up by dish. Till dishes are matched to recipes (by hand
 * in the settings, or by the same name); what is not food (drinks, gift cards) is left out, so the GP
 * stays a food GP. A line partly sent without prices uses the menu price, like a typed-in line.
 */
export function posSalesWeeks(weekRows: PosSalesRow[], dayRows: PosSalesRow[], config: OrdersConfig, recipes: Recipe[]): SalesWeek[] {
  const food = (row: PosSalesRow) => !matchesAny(config.notFood, row);
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const weeks = new Map<string, Map<string, SalesLine & { unpriced: number }>>();
  for (const row of weekRows.filter(food)) {
    const recipeId = resolveRecipe(row, config.dishMap, recipes);
    const key = recipeId ?? "name:" + dishKey(row.name);
    const lines = weeks.get(row.period) ?? new Map();
    weeks.set(row.period, lines);
    const line = lines.get(key) ?? { ...(recipeId ? { recipeId } : {}), name: (recipeId && byId.get(recipeId)?.name) || row.name, quantity: 0, revenue: 0, unpriced: 0 };
    line.quantity += row.quantity;
    line.revenue = round2((line.revenue ?? 0) + row.revenue);
    line.unpriced += row.unpriced;
    lines.set(key, line);
  }
  const days = new Map<string, { dishes: number; revenue: number; priced: boolean }>();
  for (const row of dayRows.filter(food)) {
    const day = days.get(row.period) ?? { dishes: 0, revenue: 0, priced: false };
    day.dishes += row.quantity;
    day.revenue = round2(day.revenue + row.revenue);
    day.priced ||= row.unpriced < Math.abs(row.quantity);
    days.set(row.period, day);
  }
  const mondayOf = (date: string) => {
    const at = new Date(date + "T12:00:00Z");
    at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7));
    return at.toISOString().slice(0, 10);
  };
  return Array.from(weeks, ([id, lines]) => ({
    id, source: "pos" as const, netSales: null, createdAt: "", updatedAt: "",
    lines: Array.from(lines.values()).filter((line) => line.quantity !== 0)
      .map(({ unpriced, ...line }) => ({ ...line, revenue: unpriced ? null : line.revenue }))
      .sort((a, b) => b.quantity - a.quantity),
    days: Array.from(days).filter(([date]) => mondayOf(date) === id).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => ({ date, dishes: day.dishes, revenue: day.priced ? day.revenue : null }))
  }));
}

/** The till weeks replace the weeks typed in for the same dates; the typed ones stay stored underneath. */
export function mergeSalesWeeks(manual: SalesWeek[], pos: SalesWeek[]): SalesWeek[] {
  const fromTill = new Set(pos.map((week) => week.id));
  return [...manual.filter((week) => !fromTill.has(week.id)), ...pos];
}
