import type { ScannedLine } from "@/lib/invoices/scan";
import type { StockItem } from "@/lib/types";

export type MatchStatus = "sure" | "check" | "new";

export interface LineMatch {
  status: MatchStatus;
  item: StockItem | null;
  /** The invoice price is far from the product's current price. */
  priceChanged: boolean;
}

const SURE = 0.8;
const MAYBE = 0.5;
const PRICE_JUMP = 0.3;

const tokens = (value: string) => value.toLocaleLowerCase().replace(/&/g, " and ").split(/[^\p{L}\p{N}.]+/u).map((part) => part.replace(/^\.+|\.+$/g, "")).filter(Boolean);

/** How an invoice text is remembered: lower case, punctuation dropped, single spaces. */
export const invoiceKey = (value: string) => tokens(value).join(" ");

const sameText = (a: string, b: string) => invoiceKey(a) === invoiceKey(b);

/** Words shared by the two names, counting a word that starts the other one ("ched" ~ "cheddar"). */
export function nameSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) return 0;
  const used = new Set<number>();
  let shared = 0;
  for (const word of left) {
    const at = right.findIndex((other, index) => !used.has(index) && (other === word || (Math.min(word.length, other.length) >= 3 && (other.startsWith(word) || word.startsWith(other)))));
    if (at >= 0) { used.add(at); shared += 1; }
  }
  const dice = (2 * shared) / (left.length + right.length);
  // Invoices add sizes and brands: a product whose every word is on the line is a strong match.
  return shared === right.length ? Math.max(dice, 0.85) : dice;
}

/** The kitchen's spelling of the supplier read on the invoice, or the text as read. */
export function matchSupplier(read: string, suppliers: string[]): string {
  const key = invoiceKey(read);
  if (!key) return "";
  return suppliers.find((name) => invoiceKey(name) === key)
    ?? suppliers.find((name) => invoiceKey(name) && (key.includes(invoiceKey(name)) || invoiceKey(name).includes(key)))
    ?? read;
}

/**
 * Finds the product for an invoice line: first a text already confirmed for this product, then the
 * closest name, preferring the supplier's own products.
 */
export function matchLine(line: ScannedLine, supplier: string, items: StockItem[]): LineMatch {
  const key = invoiceKey(line.description);
  const fromSupplier = (item: StockItem) => Boolean(supplier) && sameText(item.supplier || "", supplier);
  const remembered = items.filter((item) => (item.invoiceNames || []).includes(key)).sort((a, b) => Number(fromSupplier(b)) - Number(fromSupplier(a)))[0];
  let item: StockItem | null = remembered ?? null;
  let score = remembered ? 1 : 0;
  if (!item) {
    for (const candidate of items) {
      const value = Math.min(1, nameSimilarity(line.description, candidate.name) + (fromSupplier(candidate) ? 0.1 : 0));
      if (value > score) { score = value; item = candidate; }
    }
  }
  if (!item || score < MAYBE) return { status: "new", item: null, priceChanged: false };
  const price = Number(item.price) || 0;
  const priceChanged = price > 0 && line.unitPrice > 0 && Math.abs(line.unitPrice - price) / price > PRICE_JUMP;
  return { status: score >= SURE ? "sure" : "check", item, priceChanged };
}

/** The product's remembered invoice texts with this one added, or null when it is already there. */
export function withInvoiceName(item: StockItem, text: string): string[] | null {
  const key = invoiceKey(text);
  const names = item.invoiceNames || [];
  if (!key || names.includes(key) || key === invoiceKey(item.name)) return null;
  return [...names, key];
}
