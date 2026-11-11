import { num } from "@/lib/num";

export const CURRENCIES = ["EUR", "GBP", "USD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "CAD", "AUD", "JPY", "AED"];

export function currencyCode(value: string | undefined): string {
  return value && CURRENCIES.includes(value) ? value : "EUR";
}

/** Formatters bound to one locale and currency, created once per settings change. */
export function makeFormatters(locale: string, currency: string) {
  const moneyFormat = new Intl.NumberFormat(locale, { style: "currency", currency });
  const quantityFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const percentFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  const fullDate = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const symbol = currencySymbol(locale, currency);
  return {
    locale,
    currency,
    money: (value: unknown) => moneyFormat.format(num(value)),
    quantity: (value: unknown) => quantityFormat.format(num(value)),
    percent: (value: number | null) => (value === null ? "—" : percentFormat.format(value) + "%"),
    /** Labels are written with "€" and show the chosen currency instead. */
    withCurrency: (text: string) => text.replace(/€/g, symbol),
    dateLabel: (value: unknown) => {
      const date = new Date(String(value || ""));
      return Number.isNaN(date.getTime()) ? "—" : shortDate.format(date);
    },
    /** A YYYY-MM-DD day (or ISO timestamp) as a local calendar date. */
    stockDate: (value: unknown) => {
      const [y, m, d] = String(value || "").slice(0, 10).split("-").map(Number);
      return y ? fullDate.format(new Date(y, m - 1, d)) : "—";
    },
    longToday: () => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date())
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;

export function currencySymbol(locale: string, code: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: code }).formatToParts(0).find((part) => part.type === "currency")?.value || code;
}
