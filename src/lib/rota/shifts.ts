import type { RotaRow } from "@/lib/types";

// Same markers as the original Rota app, so its saved weeks can be imported unchanged.
export const DAY_OFF = "__DAY_OFF__";
export const HOLIDAY = "__HOLIDAY__";
export const DAYS_IN_WEEK = 7;

export type ShiftKind = "shift" | "dayOff" | "holiday";

export function shiftKind(value: string): ShiftKind {
  if (value === DAY_OFF) return "dayOff";
  if (value === HOLIDAY) return "holiday";
  return "shift";
}

const RANGE = /^(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})$/;

/** Hours of one "09:00-17:00" range; a range ending before it starts runs past midnight. Null when it is not a valid range. */
export function rangeHours(range: string): number | null {
  const match = range.trim().match(RANGE);
  if (!match) return null;
  const [startH, startM, endH, endM] = match.slice(1).map(Number);
  if (startH > 23 || endH > 24 || startM > 59 || endM > 59 || (endH === 24 && endM > 0)) return null;
  const start = startH * 60 + startM;
  let end = endH * 60 + endM;
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

/** Split shifts are written as several ranges: "10:00-14:00, 18:00-22:00". */
export function shiftRanges(value: string): string[] {
  return value.split(/[,;/]|\s+e\s+|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
}

/** Hours worked on a day. Markers and empty cells count zero. */
export function shiftHours(value: string): number {
  if (shiftKind(value) !== "shift") return 0;
  return shiftRanges(value).reduce((total, range) => total + (rangeHours(range) ?? 0), 0);
}

/** True when a typed shift cannot be read, so the cell can be flagged. */
export function isInvalidShift(value: string): boolean {
  if (shiftKind(value) !== "shift" || !value.trim()) return false;
  return shiftRanges(value).some((range) => rangeHours(range) === null);
}

export interface WeekTotals {
  rows: number[];
  days: number[];
  total: number;
}

export function weekTotals(rows: RotaRow[]): WeekTotals {
  const days = Array<number>(DAYS_IN_WEEK).fill(0);
  const perRow = rows.map((row) => row.shifts.reduce((total, value, day) => {
    const hours = shiftHours(value);
    days[day] += hours;
    return total + hours;
  }, 0));
  return { rows: perRow, days, total: perRow.reduce((total, hours) => total + hours, 0) };
}

/** Rows with seven shift values each, whatever was stored. */
export function normalizeRows(rows: unknown): RotaRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const value = (row && typeof row === "object" ? row : {}) as Partial<RotaRow>;
    return {
      name: typeof value.name === "string" ? value.name : "",
      shifts: Array.from({ length: DAYS_IN_WEEK }, (_, day) => (Array.isArray(value.shifts) && typeof value.shifts[day] === "string" ? value.shifts[day] : ""))
    };
  });
}

export function blankRows(names: string[], minimum = 7): RotaRow[] {
  const list = names.length >= minimum ? names : [...names, ...Array<string>(minimum - names.length).fill("")];
  return list.map((name) => ({ name, shifts: Array<string>(DAYS_IN_WEEK).fill("") }));
}

/** Rows that carry nothing are not worth saving or printing. */
export function isEmptyRow(row: RotaRow): boolean {
  return !row.name.trim() && row.shifts.every((value) => !value.trim());
}
