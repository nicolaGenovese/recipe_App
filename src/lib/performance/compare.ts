import { addDays } from "@/lib/num";
import { weekSummary } from "@/lib/performance/summary";
import { missingToday } from "@/lib/safety/rules";
import type { AppData } from "@/lib/types";

/** One site's figures over the last weeks, for the head office comparison. */
export interface SiteFigures {
  siteId: string;
  siteName: string;
  weeks: number;
  netSales: number;
  theoreticalGp: number | null;
  /** GP of the latest submitted stock report. */
  actualGp: number | null;
  waste: number;
  wastePercent: number | null;
  labour: number;
  labourPercent: number | null;
  primePercent: number | null;
  /** Food safety records out of limits in the period. */
  safetyIssues: number;
  /** Checks still to do today. */
  missingToday: number;
}

const share = (value: number, sales: number) => (sales > 0 ? (value / sales) * 100 : null);

/** Monday of the week that contains the date. */
export function mondayOf(date: string): string {
  const day = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
  return addDays(date, -day);
}

/** Adds up sales, theoretical GP, waste and labour over the complete weeks before today. */
export function siteFigures(siteId: string, siteName: string, data: AppData, today: string, weeks = 4): SiteFigures {
  const lastMonday = addDays(mondayOf(today), -7);
  const ids = Array.from({ length: weeks }, (_, index) => addDays(lastMonday, -7 * index));
  const summaries = ids.map((id) => weekSummary(data, id));
  const netSales = summaries.reduce((total, row) => total + row.sales.netSales, 0);
  const theoretical = summaries.reduce((total, row) => total + row.sales.theoreticalCost, 0);
  const waste = summaries.reduce((total, row) => total + row.waste.total, 0);
  const labour = summaries.reduce((total, row) => total + row.labour.cost, 0);
  const from = ids[ids.length - 1];
  const to = addDays(lastMonday, 6);
  const latest = data.stockReports.filter((report) => report.status === "submitted").sort((a, b) => b.dateTo.localeCompare(a.dateTo))[0];
  const latestSummary = latest ? summaries.find((row) => row.report?.id === latest.id)?.reportSummary ?? weekSummary(data, mondayOf(latest.dateTo)).reportSummary : null;
  return {
    siteId, siteName, weeks, netSales,
    theoreticalGp: netSales > 0 ? ((netSales - theoretical) / netSales) * 100 : null,
    actualGp: latestSummary?.gp ?? null,
    waste, wastePercent: share(waste, netSales), labour, labourPercent: share(labour, netSales),
    primePercent: share(theoretical + labour, netSales),
    safetyIssues: data.safetyLogs.filter((log) => !log.ok && log.date >= from && log.date <= to).length,
    missingToday: missingToday(data.safetyLogs, today, data.settings.foodSafety).length
  };
}
