import { num, round2 } from "@/lib/num";
import { shiftHours } from "@/lib/rota/shifts";
import { findStaff } from "@/lib/staff";
import type { RotaRow, StaffMember } from "@/lib/types";

/** What the labour cost needs: who earns what, and the employer extras in %. */
export interface PayRules { staff: StaffMember[]; onCostPercent: number }

export const payRules = (settings: { staff: StaffMember[]; labour: { onCostPercent: number } }): PayRules => ({ staff: settings.staff, onCostPercent: settings.labour.onCostPercent });

export const rateOf = (pay: PayRules, name: string) => num(findStaff(pay.staff, name)?.hourlyRate);

/** Pay for one rota line: hours worked × hourly rate, plus the employer extras. */
export function rowLabourCost(row: RotaRow, labour: PayRules): number {
  const hours = row.shifts.reduce((total, value) => total + shiftHours(value), 0);
  return round2(hours * rateOf(labour, row.name) * (1 + num(labour.onCostPercent) / 100));
}

export interface LabourTotals {
  hours: number;
  cost: number;
  /** People who worked hours but have no hourly rate, so their cost is missing. */
  missingRates: string[];
}

export function weekLabour(rows: RotaRow[], labour: PayRules): LabourTotals {
  let hours = 0;
  let cost = 0;
  const missingRates: string[] = [];
  for (const row of rows) {
    const rowHours = row.shifts.reduce((total, value) => total + shiftHours(value), 0);
    hours += rowHours;
    cost += rowLabourCost(row, labour);
    if (rowHours > 0 && rateOf(labour, row.name) <= 0) missingRates.push(row.name.trim() || "?");
  }
  return { hours, cost: round2(cost), missingRates };
}

/** Labour cost of each day from Monday to Sunday: that day's hours × hourly rate, plus the employer extras. */
export function dailyLabourCosts(rows: RotaRow[], labour: PayRules): number[] {
  const extra = 1 + num(labour.onCostPercent) / 100;
  return Array.from({ length: 7 }, (_, day) => round2(rows.reduce((total, row) => total + shiftHours(row.shifts[day] ?? "") * rateOf(labour, row.name) * extra, 0)));
}

/** A cost as a share of net sales, or null without sales. */
export const shareOfSales = (cost: number, netSales: number): number | null => (netSales > 0 ? (cost / netSales) * 100 : null);
