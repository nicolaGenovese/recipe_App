import { addDays } from "@/lib/num";
import type { ChecklistKind, ChecklistLog, PrepList, SafetyLog, StockDelivery, TemperatureLog } from "@/lib/types";

/**
 * Browser storage key for the device's choice: "1" after entering kitchen mode, "0" after leaving it.
 * Without a choice, phones and tablets start in kitchen mode and computers do not.
 */
export const KITCHEN_KEY = "recipe-studio:kitchen";

/** Whether the app opens in kitchen mode: a ?cucina link always does, then the device's choice, then the kind of screen. */
export function opensInKitchen(start: { link: boolean; stored: string; touch: boolean }): boolean {
  if (start.link) return true;
  if (start.stored === "1" || start.stored === "0") return start.stored === "1";
  return start.touch;
}


/**
 * Prep lists for the kitchen screen: the ones for today; with none, the closest one, preferring the
 * next service to a past one, so the tablet always opens on something useful.
 */
export function kitchenPrepLists(lists: PrepList[], today: string): PrepList[] {
  const todays = lists.filter((list) => list.date === today);
  if (todays.length) return todays.sort((a, b) => a.name.localeCompare(b.name));
  const next = lists.filter((list) => list.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const last = lists.filter((list) => list.date < today).sort((a, b) => b.date.localeCompare(a.date))[0];
  return next ? [next] : last ? [last] : [];
}

/** The morning round before 2 pm, the evening one after, as on the temperature form. */
export const slotOf = (date: Date): "am" | "pm" => (date.getHours() < 14 ? "am" : "pm");

/** Today's temperature round for a slot, the latest if it was entered twice. */
export function todaysTemperature(logs: SafetyLog[], today: string, slot: "am" | "pm"): TemperatureLog | undefined {
  return logs.filter((log): log is TemperatureLog => log.kind === "temperature" && log.date === today && log.slot === slot)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** Today's checklist of a kind, so the kitchen continues the same record instead of starting another. */
export function todaysChecklist(logs: SafetyLog[], today: string, list: ChecklistKind): ChecklistLog | undefined {
  return logs.filter((log): log is ChecklistLog => log.kind === "checklist" && log.date === today && log.list === list)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/**
 * The checklist items to show: today's record if there is one, with any item added in the settings
 * since then appended unticked; otherwise the items from the settings.
 */
export function checklistItems(settingsItems: string[], record?: Pick<ChecklistLog, "items">): ChecklistLog["items"] {
  const items = record ? [...record.items] : [];
  for (const label of settingsItems) if (!items.some((item) => item.label === label)) items.push({ label, done: false, by: "", at: "" });
  return items;
}

/** Flips the sign of a typed temperature, for keypads without a minus key ("4" → "-4", "-18" → "18"). */
export const flipSign = (value: string) => (value.trim() === "" ? "-" : value.startsWith("-") ? value.slice(1) : "-" + value);

/** Deliveries entered in Food Stock in the last three days that nobody has checked yet, newest first. */
export function uncheckedDeliveries(deliveries: StockDelivery[], logs: SafetyLog[], today: string): StockDelivery[] {
  const checked = new Set(logs.flatMap((log) => (log.kind === "delivery" && log.deliveryId ? [log.deliveryId] : [])));
  const from = addDays(today, -2);
  return deliveries.filter((delivery) => delivery.date >= from && delivery.date <= today && !checked.has(delivery.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
