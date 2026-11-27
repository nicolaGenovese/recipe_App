import { productKind, type ProductKind } from "@/lib/stock/kind";

/** What an invoice reader returns, whatever AI service read the photo. Shared by server and browser. */
export interface ScannedLine {
  /** Product text as printed on the invoice. */
  description: string;
  /** Supplier's product code, when printed. */
  code: string;
  /** Units of sale received (cases, packs, kilos…). */
  quantity: number;
  /** Price of one unit of sale, VAT excluded. */
  unitPrice: number;
  /** Line total, VAT excluded, as printed; used to check the reading. */
  lineTotal: number | null;
  /** Food, or a cleaning product or supply: decides the kind of a product created from this line. */
  kind: ProductKind;
}

export interface ScannedInvoice {
  supplier: string;
  invoiceNumber: string;
  /** ISO date YYYY-MM-DD, or "" when unreadable. */
  date: string;
  /** Invoice total VAT excluded, or null. */
  netTotal: number | null;
  lines: ScannedLine[];
}

/** One photo or PDF page sent to the reader, base64 without the data: prefix. */
export interface InvoiceImage { mimeType: string; data: string }

export const INVOICE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_INVOICE_FILES = 5;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

/** Reads "1,234.50", "£12.40" or 12.4 as a number; anything else is null. */
function amount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const clean = value.replace(/[^\d.,-]/g, "");
  if (!clean) return null;
  // A comma followed by exactly two digits at the end is a decimal comma (12,40); otherwise commas group thousands.
  const normal = /,\d{1,2}$/.test(clean) && !clean.includes(".") ? clean.replace(",", ".") : clean.replace(/,/g, "");
  const parsed = Number(normal);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown): string {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // UK invoices: day first.
  const uk = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!uk) return "";
  const year = uk[3].length === 2 ? "20" + uk[3] : uk[3];
  return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
}

/**
 * Cleans what a model answered, so a reader that returns odd types or extra fields cannot break the
 * dialog. Lines without a description or a positive quantity are dropped; a missing unit price is
 * worked out from the line total.
 */
export function normalizeScan(raw: unknown): ScannedInvoice {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lines = (Array.isArray(value.lines) ? value.lines : []).flatMap((entry): ScannedLine[] => {
    const line = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const description = text(line.description).replace(/\s+/g, " ");
    const quantity = amount(line.quantity) ?? 0;
    const lineTotal = amount(line.lineTotal);
    let unitPrice = amount(line.unitPrice) ?? 0;
    if (!unitPrice && lineTotal && quantity) unitPrice = Math.round((lineTotal / quantity) * 10000) / 10000;
    if (!description || quantity <= 0) return [];
    return [{ description, code: text(line.code), quantity, unitPrice, lineTotal, kind: productKind(line) }];
  });
  return { supplier: text(value.supplier), invoiceNumber: text(value.invoiceNumber), date: isoDate(value.date), netTotal: amount(value.netTotal), lines };
}
