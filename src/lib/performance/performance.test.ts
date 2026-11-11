import { describe, expect, it } from "vitest";
import { dailyLabourCosts, rowLabourCost, weekLabour } from "@/lib/performance/labour";
import { analyseMenu, parseSalesCsv, salesTotals, suggestedPortions } from "@/lib/performance/sales";
import { reportForWeek } from "@/lib/performance/summary";
import { wasteTotals, wasteUnitCost } from "@/lib/performance/waste";
import type { Ingredient, Recipe, StockItem, StockReport, WasteLog } from "@/lib/types";

const ing = (cost: number): Ingredient => ({ type: "Prodotto", name: "x", supplier: "", quantity: 1, unit: "kg", unitCost: cost, allergens: [], kcal: 0 });
const dish = (id: string, name: string, price: number, cost: number): Recipe => ({ id, name, category: "", portions: 1, archivedBatch: false, sellingPrice: price, vat: 20, ingredients: [ing(cost)] });
const recipes = [dish("burger", "Beef Burger", 18, 4.5), dish("fish", "Beer-Battered Fish", 18, 3), dish("salad", "Side Salad", 6, 1), dish("pie", "Shepherd's Pie", 12, 5)];
const rules = { defaultVat: 20 };
const week = (id: string, lines: { recipeId?: string; name: string; quantity: number; revenue?: number | null }[]) => ({ id, lines, createdAt: "", updatedAt: "" });

describe("sales", () => {
  it("adds up net sales and theoretical cost, using till takings when given", () => {
    const totals = salesTotals(week("w", [{ recipeId: "burger", name: "Beef Burger", quantity: 10 }, { recipeId: "fish", name: "Fish", quantity: 2, revenue: 30 }, { name: "Mystery", quantity: 1 }]), recipes, rules);
    expect(totals.linesNet).toBeCloseTo(150 + 25 + 0, 2);
    expect(totals.theoreticalCost).toBe(51);
    expect(totals.theoreticalGp).toBeCloseTo((175 - 51) / 175 * 100, 4);
    expect(totals.unmatched).toEqual(["Mystery"]);
  });

  it("classifies dishes as stars, plowhorses, puzzles and dogs", () => {
    const rows = analyseMenu([week("w", [
      { recipeId: "burger", name: "", quantity: 50 }, { recipeId: "fish", name: "", quantity: 40 }, { recipeId: "salad", name: "", quantity: 30 }, { recipeId: "pie", name: "", quantity: 2 }
    ])], recipes, rules);
    const kind = Object.fromEntries(rows.map((row) => [row.recipeId, row.kind]));
    expect(kind).toEqual({ burger: "star", fish: "star", salad: "plowhorse", pie: "dog" });
  });

  it("reads a till export and suggests daily portions", () => {
    const lines = parseSalesCsv('Item;Qty;Total\nbeef burger;12;"215,00"\nBeef Burger;2;35\nCoke;5;12.5\n', recipes);
    expect(lines).toEqual([{ recipeId: "burger", name: "beef burger", quantity: 14, revenue: 250 }, { name: "Coke", quantity: 5, revenue: 12.5 }]);
    const weeks = [week("2026-11-02", [{ recipeId: "burger", name: "", quantity: 70 }]), week("2026-11-09", [{ recipeId: "burger", name: "", quantity: 35 }])];
    expect(suggestedPortions(weeks, "burger")).toBe(8);
    expect(suggestedPortions([], "burger")).toBe(0);
  });
});

describe("waste and labour", () => {
  it("costs waste from products and recipes and groups it by reason", () => {
    const item = { id: "p", price: 10, recipeContent: 2, recipeUnit: "kg" } as StockItem;
    expect(wasteUnitCost("product", "p", "g", recipes, [item])).toBeCloseTo(0.005);
    expect(wasteUnitCost("recipe", "pie", "porz", recipes, [])).toBe(5);
    const log = (reason: WasteLog["reason"], quantity: number, unitCost: number, name = "a") => ({ id: name, date: "2026-11-10", source: "other", name, quantity, unit: "", unitCost, reason, by: "", createdAt: "", updatedAt: "" }) as WasteLog;
    const totals = wasteTotals([log("expired", 2, 3, "milk"), log("error", 1, 5, "pie"), log("expired", 1, 1, "milk")]);
    expect(totals.total).toBe(12);
    expect(totals.byReason.expired).toBe(7);
    expect(totals.byItem[0]).toEqual({ name: "milk", cost: 7, count: 2 });
  });

  it("works out labour cost with employer extras and flags missing rates", () => {
    const labour = { staff: [{ id: "b", name: "Bruno", hourlyRate: 12.5, active: true }], onCostPercent: 10 };
    expect(rowLabourCost({ name: "Bruno", shifts: ["09:00-17:00", "", "", "", "", "", ""] }, labour)).toBe(110);
    const totals = weekLabour([{ name: "Bruno", shifts: ["09:00-17:00", "", "", "", "", "", ""] }, { name: "Abi", shifts: ["10:00-14:00", "", "", "", "", "", ""] }], labour);
    expect(totals).toEqual({ hours: 12, cost: 110, missingRates: ["Abi"] });
    const rows = [{ name: "Bruno", shifts: ["09:00-17:00", "18:00-02:00", "", "", "", "", ""] }, { name: "Nicola", shifts: ["10:00-14:00", "", "", "", "", "", ""] }];
    const pay = { staff: [{ id: "b", name: "Bruno", hourlyRate: 12.5, active: true }, { id: "n", name: "Nicola", hourlyRate: 10, active: false }], onCostPercent: 10 };
    expect(dailyLabourCosts(rows, pay)).toEqual([154, 110, 0, 0, 0, 0, 0]);
  });

  it("picks the submitted stock report that overlaps the week most", () => {
    const report = (id: string, dateFrom: string, dateTo: string, status: StockReport["status"] = "submitted") => ({ id, dateFrom, dateTo, status }) as StockReport;
    const reports = [report("a", "2026-10-26", "2026-11-10"), report("b", "2026-11-11", "2026-11-30"), report("c", "2026-11-09", "2026-11-15", "draft")];
    expect(reportForWeek(reports, "2026-11-09")?.id).toBe("b");
    expect(reportForWeek(reports, "2026-12-07")).toBeNull();
  });
});
