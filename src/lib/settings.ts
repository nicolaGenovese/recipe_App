import { DEFAULT_SETTINGS } from "@/lib/seed";
import { clone } from "@/lib/num";
import { cleanStaff, staffFromRota } from "@/lib/staff";
import type { Equipment, FoodSafetySettings, GpRules, RotaWeek, Settings } from "@/lib/types";

const limit = (value: unknown): number | null => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));

function cleanEquipment(row: Equipment): Equipment {
  return { id: row.id, name: String(row.name ?? "").trim(), kind: row.kind === "freezer" || row.kind === "hot" ? row.kind : "fridge", min: limit(row.min), max: limit(row.max) };
}

/**
 * Fills anything missing from older archives, including GP rules saved before a rule existed.
 * Archives from before the staff list build it from the names on the rota.
 */
export function normalizeSettings(raw: Partial<Settings> | null | undefined, rotaWeeks: Pick<RotaWeek, "id" | "rows">[] = []): Settings {
  const base = clone(DEFAULT_SETTINGS);
  const safety = (raw?.foodSafety || {}) as Partial<FoodSafetySettings>;
  return {
    ...base, ...(raw || {}), gp: { ...base.gp, ...(raw?.gp || {}) } as GpRules,
    labour: { onCostPercent: Number.isFinite(Number(raw?.labour?.onCostPercent)) ? Math.max(0, Number(raw?.labour?.onCostPercent)) : base.labour.onCostPercent },
    units: Array.isArray(raw?.units) && raw.units.some((unit) => typeof unit === "string" && unit.trim())
      ? Array.from(new Set(raw.units.filter((unit): unit is string => typeof unit === "string").map((unit) => unit.trim()).filter(Boolean)))
      : base.units,
    language: raw?.language === "it" ? "it" : "en",
    staff: Array.isArray(raw?.staff) ? cleanStaff(raw.staff) : staffFromRota(rotaWeeks, raw?.labour?.rates || {}),
    foodSafety: {
      ...base.foodSafety, ...safety,
      equipment: Array.isArray(safety.equipment) ? safety.equipment.filter((row) => row && typeof row.id === "string" && row.id).map(cleanEquipment) : base.foodSafety.equipment,
      checklists: { ...base.foodSafety.checklists, ...(safety.checklists || {}) }
    }
  };
}
