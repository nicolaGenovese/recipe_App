import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import { checklistOk, cookingOk, deliveryOk, evaluate, minutesBetween, missingToday, readingOk, useByDate } from "@/lib/safety/rules";
import { staffNames } from "@/lib/safety/staff";
import type { SafetyLog, TemperatureLog } from "@/lib/types";

const rules = DEFAULT_SETTINGS.foodSafety;
const base = { id: "x", date: "2026-11-11", time: "09:00", by: "Bruno", ok: true, createdAt: "", updatedAt: "" };

describe("food safety rules", () => {
  it("checks fridge and freezer readings against their limits", () => {
    expect(readingOk(4, { min: 0, max: 5 })).toBe(true);
    expect(readingOk(7, { min: 0, max: 5 })).toBe(false);
    expect(readingOk(-20, { min: null, max: -18 })).toBe(true);
    expect(readingOk(-12, { min: null, max: -18 })).toBe(false);
    expect(readingOk(null, { min: 0, max: 5 })).toBe(true);
  });

  it("checks cooking, reheating and cooling", () => {
    expect(cookingOk({ process: "cook", temperature: 78 }, rules)).toBe(true);
    expect(cookingOk({ process: "reheat", temperature: 70 }, rules)).toBe(false);
    expect(cookingOk({ process: "hotHold", temperature: 65 }, rules)).toBe(true);
    expect(cookingOk({ process: "cool", temperature: 7, startTime: "14:00", endTime: "15:20" }, rules)).toBe(true);
    expect(cookingOk({ process: "cool", temperature: 7, startTime: "14:00", endTime: "16:00" }, rules)).toBe(false);
    expect(cookingOk({ process: "cool", temperature: 12, startTime: "14:00", endTime: "15:00" }, rules)).toBe(false);
    expect(minutesBetween("23:30", "00:45")).toBe(75);
  });

  it("checks deliveries and checklists", () => {
    expect(deliveryOk({ chilledTemperature: 4, frozenTemperature: -19, packagingOk: true, datesOk: true }, rules)).toBe(true);
    expect(deliveryOk({ chilledTemperature: 9, frozenTemperature: null, packagingOk: true, datesOk: true }, rules)).toBe(false);
    expect(deliveryOk({ chilledTemperature: null, frozenTemperature: null, packagingOk: false, datesOk: true }, rules)).toBe(false);
    expect(checklistOk({ items: [{ label: "a", done: true, by: "B", at: "" }] })).toBe(true);
    expect(checklistOk({ items: [{ label: "a", done: false, by: "", at: "" }] })).toBe(false);
  });

  it("re-evaluates a temperature round reading by reading", () => {
    const log: TemperatureLog = { ...base, kind: "temperature", slot: "am", readings: [
      { equipmentId: "fridge-1", name: "Frigo 1", value: 3, ok: false }, { equipmentId: "freezer-1", name: "Congelatore 1", value: -10, ok: true }
    ] };
    const checked = evaluate(log, rules) as TemperatureLog;
    expect(checked.readings.map((reading) => reading.ok)).toEqual([true, false]);
    expect(checked.ok).toBe(false);
  });

  it("lists what is missing today", () => {
    const logs: SafetyLog[] = [
      { ...base, kind: "temperature", slot: "am", readings: [] },
      { ...base, kind: "checklist", list: "opening", items: [{ label: "a", done: true, by: "B", at: "" }] }
    ];
    expect(missingToday(logs, "2026-11-11", rules)).toEqual(["temperature:pm", "checklist:closing"]);
  });

  it("works out use-by dates and staff names", () => {
    expect(useByDate("2026-11-10", 3)).toBe("2026-11-13");
    expect(useByDate("2026-11-30", 2)).toBe("2026-12-02");
    const weeks = [
      { id: "2026-11-09", rows: [{ name: "Suray", shifts: [] }, { name: "", shifts: [] }], createdAt: "", updatedAt: "" },
      { id: "2026-11-02", rows: [{ name: "Abi", shifts: [] }, { name: "Suray ", shifts: [] }], createdAt: "", updatedAt: "" }
    ];
    expect(staffNames(weeks, "2026-11-11")).toEqual(["Suray", "Abi"]);
  });
});
