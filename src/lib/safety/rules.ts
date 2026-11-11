import { addDays } from "@/lib/num";
import type { ChecklistKind, ChecklistLog, CookingLog, CookingProcess, DeliveryCheckLog, Equipment, FoodSafetySettings, SafetyLog, TemperatureLog } from "@/lib/types";

/** True when the reading is inside the equipment's range. An empty reading is not a failure: it is a missing check. */
export function readingOk(value: number | null, equipment: Pick<Equipment, "min" | "max">): boolean {
  if (value === null) return true;
  if (equipment.min !== null && value < equipment.min) return false;
  if (equipment.max !== null && value > equipment.max) return false;
  return true;
}

export function temperatureOk(log: Pick<TemperatureLog, "readings">): boolean {
  return log.readings.every((reading) => reading.ok);
}

/** Minutes between two HH:MM times; cooling that runs past midnight wraps around. */
export function minutesBetween(start: string, end: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const from = parse(start);
  const to = parse(end);
  if (from === null || to === null) return null;
  return to >= from ? to - from : to + 24 * 60 - from;
}

/** The limit each process must meet, for messages and table headings. */
export function processLimit(process: CookingProcess, rules: FoodSafetySettings): number {
  if (process === "cool") return rules.coolTarget;
  if (process === "reheat") return rules.reheatMin;
  if (process === "hotHold") return rules.hotHoldMin;
  return rules.cookMin;
}

export function cookingOk(log: Pick<CookingLog, "process" | "temperature" | "startTime" | "endTime">, rules: FoodSafetySettings): boolean {
  if (log.temperature === null) return false;
  if (log.process !== "cool") return log.temperature >= processLimit(log.process, rules);
  const minutes = minutesBetween(log.startTime ?? "", log.endTime ?? "");
  return log.temperature <= rules.coolTarget && minutes !== null && minutes <= rules.coolMinutes;
}

export function deliveryOk(log: Pick<DeliveryCheckLog, "chilledTemperature" | "frozenTemperature" | "packagingOk" | "datesOk">, rules: FoodSafetySettings): boolean {
  if (log.chilledTemperature !== null && log.chilledTemperature > rules.chilledDeliveryMax) return false;
  if (log.frozenTemperature !== null && log.frozenTemperature > rules.frozenDeliveryMax) return false;
  return log.packagingOk && log.datesOk;
}

export function checklistOk(log: Pick<ChecklistLog, "items">): boolean {
  return log.items.length > 0 && log.items.every((item) => item.done);
}

/** Re-checks a record against the current limits, so the stored "ok" always matches what was entered. */
export function evaluate(log: SafetyLog, rules: FoodSafetySettings): SafetyLog {
  if (log.kind === "temperature") {
    const readings = log.readings.map((reading) => {
      const equipment = rules.equipment.find((row) => row.id === reading.equipmentId);
      return { ...reading, ok: equipment ? readingOk(reading.value, equipment) : true };
    });
    return { ...log, readings, ok: readings.every((reading) => reading.ok) };
  }
  if (log.kind === "cooking") return { ...log, ok: cookingOk(log, rules) };
  if (log.kind === "delivery") return { ...log, ok: deliveryOk(log, rules) };
  return { ...log, ok: checklistOk(log) };
}

/** What is still to do today: the two temperature rounds and the opening and closing checklists. */
export function missingToday(logs: SafetyLog[], today: string, rules: FoodSafetySettings): string[] {
  const todays = logs.filter((log) => log.date === today);
  const missing: string[] = [];
  if (rules.equipment.length) {
    for (const slot of ["am", "pm"] as const) {
      if (!todays.some((log) => log.kind === "temperature" && log.slot === slot)) missing.push("temperature:" + slot);
    }
  }
  for (const list of ["opening", "closing"] as ChecklistKind[]) {
    if (rules.checklists[list].length && !todays.some((log) => log.kind === "checklist" && log.list === list && log.ok)) missing.push("checklist:" + list);
  }
  return missing;
}

/** Records in a date range, newest first. */
export function logsBetween<K extends SafetyLog["kind"]>(logs: SafetyLog[], kind: K, from: string, to: string): Extract<SafetyLog, { kind: K }>[] {
  return logs
    .filter((log): log is Extract<SafetyLog, { kind: K }> => log.kind === kind && log.date >= from && log.date <= to)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

/** Use-by date: the day it was made plus its shelf life in days (made on the 10th with 3 days → use by the 13th). */
export function useByDate(made: string, shelfLifeDays: number): string {
  return addDays(made, Math.max(0, Math.round(shelfLifeDays)));
}
