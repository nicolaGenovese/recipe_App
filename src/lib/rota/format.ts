import { DAY_OFF, HOLIDAY } from "@/lib/rota/shifts";
import { weekDays } from "@/lib/rota/weeks";

const toDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Text shown, printed and exported for a cell. */
export function cellLabel(value: string, labels: { dayOff: string; holiday: string }): string {
  if (value === DAY_OFF) return labels.dayOff;
  if (value === HOLIDAY) return labels.holiday;
  return value;
}

export function makeRotaFormat(locale: string) {
  const long = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const hours = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    hours: (value: number) => hours.format(value),
    weekLabel: (weekId: string) => {
      const days = weekDays(weekId);
      return long.format(toDate(days[0])) + " – " + long.format(toDate(days[6]));
    },
    /** Day headings: weekday name, capitalised, and the day of the month. */
    dayHeads: (weekId: string) => weekDays(weekId).map((key) => {
      const name = weekday.format(toDate(key));
      return { key, name: name.charAt(0).toUpperCase() + name.slice(1), day: toDate(key).getDate() };
    })
  };
}

export type RotaFormat = ReturnType<typeof makeRotaFormat>;
