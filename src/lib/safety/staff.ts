import { mondayOf } from "@/lib/rota/weeks";
import type { RotaWeek, StaffMember } from "@/lib/types";

/**
 * Names to sign a record with: the people on the rota of that week first, then the active staff,
 * then everyone who has ever been on the rota. Duplicates and empty names are dropped.
 */
export function staffNames(weeks: RotaWeek[], date: string, staff: StaffMember[] = []): string[] {
  const [y, m, d] = date.split("-").map(Number);
  const weekId = y ? mondayOf(new Date(y, m - 1, d)) : "";
  const clean = (names: string[]) => names.map((name) => name.trim()).filter(Boolean);
  const thisWeek = clean(weeks.find((week) => week.id === weekId)?.rows.map((row) => row.name) ?? []);
  const everyone = clean([...weeks].sort((a, b) => b.id.localeCompare(a.id)).flatMap((week) => week.rows.map((row) => row.name)));
  const team = clean(staff.filter((member) => member.active).map((member) => member.name));
  return Array.from(new Set([...thisWeek, ...team, ...everyone]));
}
