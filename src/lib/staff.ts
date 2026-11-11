import { num } from "@/lib/num";
import type { RotaWeek, StaffMember } from "@/lib/types";

/** Ids follow the name, so the same person gets the same id every time the list is built. */
export function staffId(name: string): string {
  return "staff-" + (name.trim().toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x");
}

export function cleanStaff(rows: unknown): StaffMember[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const value = (row && typeof row === "object" ? row : {}) as Partial<StaffMember>;
    const name = String(value.name ?? "").trim();
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) return [];
    seen.add(key);
    return [{
      id: typeof value.id === "string" && value.id ? value.id : staffId(name), name, role: String(value.role ?? "").trim(),
      hourlyRate: Math.max(0, num(value.hourlyRate)), active: value.active !== false
    }];
  });
}

/**
 * Archives from before the staff list: everyone named on a rota becomes a member,
 * newest weeks first, with the hourly rate typed on the rota if there was one.
 */
export function staffFromRota(weeks: Pick<RotaWeek, "id" | "rows">[], rates: Record<string, number> = {}): StaffMember[] {
  const names = [...weeks].sort((a, b) => b.id.localeCompare(a.id)).flatMap((week) => week.rows.map((row) => row.name));
  return cleanStaff(names.map((name) => ({ name, hourlyRate: num(rates[name.trim()]), active: true })));
}

export const activeStaff = (staff: StaffMember[]) => staff.filter((member) => member.active);

export function findStaff(staff: StaffMember[], name: string): StaffMember | undefined {
  const key = name.trim().toLocaleLowerCase();
  return staff.find((member) => member.name.toLocaleLowerCase() === key);
}
