import { addDays, dateKey } from "@/lib/num";
import { DAYS_IN_WEEK } from "@/lib/rota/shifts";
import type { RotaRow, RotaWeek, StaffMember } from "@/lib/types";

/** How many weeks can be planned: the current one and the three after it. */
export const PLANNABLE_WEEKS = 4;

export function mondayOf(date: Date): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return dateKey(day);
}

export function isMondayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return dateKey(date) === value && date.getDay() === 1;
}

export function weekDays(weekId: string): string[] {
  return Array.from({ length: 7 }, (_, day) => addDays(weekId, day));
}

/** The weeks that can be edited: this week and the next three. */
export function plannableWeeks(today: Date): string[] {
  const first = mondayOf(today);
  return Array.from({ length: PLANNABLE_WEEKS }, (_, index) => addDays(first, index * 7));
}

/** Saved weeks before the current one, newest first. They are shown read-only. */
export function pastWeeks(weeks: RotaWeek[], today: Date): string[] {
  const current = mondayOf(today);
  return weeks.map((week) => week.id).filter((id) => id < current).sort((a, b) => b.localeCompare(a));
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

/**
 * The lines of an editable week: one for each active staff member, in the order of the staff list,
 * with the shifts already saved for them. Lines of people who are no longer active, or have no name,
 * stay only while they still have shifts that week, so nothing typed is lost.
 */
export function rowsForStaff(stored: RotaRow[], staff: StaffMember[]): RotaRow[] {
  const saved = new Map(stored.filter((row) => row.name.trim()).map((row) => [nameKey(row.name), row]));
  const team = staff.filter((member) => member.active);
  const rows = team.map((member) => ({ name: member.name, shifts: saved.get(nameKey(member.name))?.shifts ?? Array<string>(DAYS_IN_WEEK).fill("") }));
  const inTeam = new Set(team.map((member) => nameKey(member.name)));
  return rows.concat(stored.filter((row) => !inTeam.has(nameKey(row.name)) && row.shifts.some((shift) => shift.trim())));
}
