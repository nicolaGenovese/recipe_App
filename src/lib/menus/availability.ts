import type { Menu, MenuAvailability, MenuSlot } from "@/lib/types";

/** Days are numbered Monday = 0 … Sunday = 6, the order the kitchen week is shown in. */
export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Monday-first day number of a date. */
export const weekDay = (date: Date) => (date.getDay() + 6) % 7;

/**
 * Cleans what the editor or the API sends: days kept once and in order, slots with two valid
 * times that differ. Nothing left (all days, no hours) means "always available", stored as undefined.
 */
export function normalizeAvailability(value: unknown): MenuAvailability | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { days?: unknown; slots?: unknown };
  const days = Array.isArray(raw.days) ? WEEK_DAYS.filter((day) => raw.days instanceof Array && raw.days.includes(day)) : [];
  const slots: MenuSlot[] = Array.isArray(raw.slots)
    ? raw.slots.filter((slot): slot is MenuSlot => Boolean(slot) && typeof slot === "object" && TIME.test(String(slot.from)) && TIME.test(String(slot.to)) && slot.from !== slot.to)
      .map((slot) => ({ from: slot.from, to: slot.to }))
    : [];
  const everyDay = days.length === 0 || days.length === WEEK_DAYS.length;
  if (everyDay && !slots.length) return undefined;
  return { days: everyDay ? [] : days, slots };
}

/**
 * Whether the menu is served at the given moment. A slot that ends before it starts runs past
 * midnight: its hours after midnight belong to the day it started on.
 */
export function isAvailableAt(availability: MenuAvailability | undefined, date: Date): boolean {
  if (!availability) return true;
  const today = weekDay(date);
  const yesterday = (today + 6) % 7;
  const onDay = (day: number) => !availability.days.length || availability.days.includes(day);
  if (!availability.slots.length) return onDay(today);
  const now = date.getHours() * 60 + date.getMinutes();
  return availability.slots.some((slot) => {
    const from = minutes(slot.from);
    const to = minutes(slot.to);
    if (from < to) return onDay(today) && now >= from && now < to;
    return (onDay(today) && now >= from) || (onDay(yesterday) && now < to);
  });
}

/** Days written as ranges: [0,1,2,3,4] → "Mon–Fri", [5,6] → "Sat, Sun". */
export function daysLabel(days: number[], dayName: (day: number) => string): string {
  const runs: number[][] = [];
  for (const day of days) {
    const last = runs.at(-1);
    if (last && last.at(-1) === day - 1) last.push(day);
    else runs.push([day]);
  }
  return runs.map((run) => (run.length > 2 ? dayName(run[0]) + "–" + dayName(run.at(-1)!) : run.map(dayName).join(", "))).join(", ");
}

/** One line for cards and the sidebar, e.g. "Sun · 12:00–17:00", or "" when always available. */
export function availabilityLabel(menu: Pick<Menu, "availability">, dayName: (day: number) => string, everyDay: string): string {
  const availability = menu.availability;
  if (!availability) return "";
  const days = availability.days.length ? daysLabel(availability.days, dayName) : everyDay;
  const hours = availability.slots.map((slot) => slot.from + "–" + slot.to).join(", ");
  return hours ? days + " · " + hours : days;
}

/** Short weekday names for the given locale, Monday first. */
export function dayNames(locale: string): (day: number) => string {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 5 January 2026 is a Monday.
  const names = WEEK_DAYS.map((day) => {
    const name = format.format(new Date(2026, 0, 5 + day)).replace(/\.$/, "");
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  });
  return (day) => names[day];
}
