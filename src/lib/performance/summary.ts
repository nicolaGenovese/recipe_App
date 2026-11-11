import { addDays } from "@/lib/num";
import { dailyLabourCosts, payRules, shareOfSales, weekLabour, type LabourTotals } from "@/lib/performance/labour";
import { salesTotals, type SalesTotals } from "@/lib/performance/sales";
import { wasteBetween, wasteTotals, type WasteTotals } from "@/lib/performance/waste";
import { normalizeRows } from "@/lib/rota/shifts";
import { summarizeReport, type ReportSummary } from "@/lib/stock/report";
import type { AppData, StockReport } from "@/lib/types";

export interface WeekSummary {
  weekId: string;
  weekEnd: string;
  sales: SalesTotals;
  waste: WasteTotals;
  wastePercent: number | null;
  labour: LabourTotals;
  labourPercent: number | null;
  /** Labour cost of each day, Monday to Sunday. */
  labourByDay: number[];
  /** Food cost in theory plus labour: the two biggest costs of a kitchen. */
  primeCost: number;
  primePercent: number | null;
  /** The submitted stock report whose period overlaps the week most, for the actual GP. */
  report: StockReport | null;
  reportSummary: ReportSummary | null;
}

const overlapDays = (fromA: string, toA: string, fromB: string, toB: string) => {
  const from = fromA > fromB ? fromA : fromB;
  const to = toA < toB ? toA : toB;
  if (from > to) return 0;
  let days = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) days += 1;
  return days;
};

export function reportForWeek(reports: StockReport[], weekId: string): StockReport | null {
  const weekEnd = addDays(weekId, 6);
  return reports.filter((report) => report.status === "submitted")
    .map((report) => ({ report, days: overlapDays(report.dateFrom, report.dateTo, weekId, weekEnd) }))
    .filter((row) => row.days > 0)
    .sort((a, b) => b.days - a.days)[0]?.report ?? null;
}

/** Sales, theoretical and actual GP, waste, labour and prime cost for one week, in one place. */
export function weekSummary(data: AppData, weekId: string): WeekSummary {
  const weekEnd = addDays(weekId, 6);
  const { gp } = data.settings;
  const labourSettings = payRules(data.settings);
  const sales = salesTotals(data.salesWeeks.find((week) => week.id === weekId), data.recipes, gp);
  const waste = wasteTotals(wasteBetween(data.wasteLogs, weekId, weekEnd));
  const rota = data.rotaWeeks.find((week) => week.id === weekId);
  const rotaRows = normalizeRows(rota?.rows ?? []);
  const labour = weekLabour(rotaRows, labourSettings);
  const report = reportForWeek(data.stockReports, weekId);
  const primeCost = sales.theoreticalCost + labour.cost;
  return {
    weekId, weekEnd, sales, waste, wastePercent: shareOfSales(waste.total, sales.netSales), labour, labourPercent: shareOfSales(labour.cost, sales.netSales), labourByDay: dailyLabourCosts(rotaRows, labourSettings),
    primeCost, primePercent: shareOfSales(primeCost, sales.netSales), report, reportSummary: report ? summarizeReport(report, gp) : null
  };
}
