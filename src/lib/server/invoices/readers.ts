import { normalizeScan, type InvoiceImage, type ScannedInvoice } from "@/lib/invoices/scan";
import { HttpError } from "@/lib/server/validation";

/** Context that helps the model write names the kitchen already uses. */
export interface ReadHints { suppliers: string[] }

/**
 * An AI service that turns invoice photos into structured data. To add another service, write a
 * reader with the same shape and register it in READERS; INVOICE_READER then picks it.
 */
export interface InvoiceReader {
  name: string;
  read(images: InvoiceImage[], hints: ReadHints): Promise<ScannedInvoice>;
}

export function invoicePrompt(hints: ReadHints): string {
  return [
    "You read supplier invoices and delivery notes for a restaurant kitchen in the UK.",
    "Transcribe the invoice in the images (several images are pages of the same invoice).",
    "- supplier: the company that issued the invoice." + (hints.suppliers.length ? " If it is one of these, write it exactly like this: " + hints.suppliers.join("; ") + "." : ""),
    "- invoiceNumber: the invoice or delivery note number.",
    "- date: invoice or delivery date as YYYY-MM-DD (dates are day first).",
    "- netTotal: total excluding VAT, or null if not printed.",
    "- lines: one entry per product line. description as printed; code = supplier product code or \"\";",
    "  quantity = units of sale delivered (cases, packs, kg…); unitPrice = price per unit of sale excluding VAT;",
    "  lineTotal = line total excluding VAT or null.",
    "Skip delivery charges, deposits, credits, VAT and subtotal lines. Never invent values: use \"\" or null when unreadable.",
    "Write numbers as plain numbers without currency symbols."
  ].join("\n");
}

/** JSON schema in the OpenAPI subset Gemini accepts for structured output. */
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    supplier: { type: "STRING" },
    invoiceNumber: { type: "STRING" },
    date: { type: "STRING" },
    netTotal: { type: "NUMBER", nullable: true },
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          code: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unitPrice: { type: "NUMBER" },
          lineTotal: { type: "NUMBER", nullable: true }
        },
        required: ["description", "quantity", "unitPrice"]
      }
    }
  },
  required: ["supplier", "invoiceNumber", "date", "lines"]
};

/** Google Gemini through its REST API; the free tier of Google AI Studio is enough for a few invoices a day. */
export function geminiReader(apiKey: string, model: string): InvoiceReader {
  return {
    name: "gemini",
    async read(images, hints) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: invoicePrompt(hints) }, ...images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.data } }))] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA }
        })
      });
      const payload = await response.json().catch(() => ({})) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { code?: number; message?: string };
      };
      if (!response.ok) {
        console.error("Gemini:", response.status, payload.error?.message);
        if (response.status === 429) throw new HttpError(429, "Limite gratuito di letture raggiunto: riprova più tardi o inserisci le righe a mano.");
        if (response.status === 400 || response.status === 403) throw new HttpError(502, "Il servizio di lettura ha rifiutato la richiesta: controlla la chiave GEMINI_API_KEY.");
        throw new HttpError(502, "Il servizio di lettura non risponde: riprova tra poco.");
      }
      const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      try { return normalizeScan(JSON.parse(answer)); }
      catch { throw new HttpError(502, "Non sono riuscito a leggere la fattura: prova con una foto più nitida."); }
    }
  };
}

/**
 * Returns a fixed invoice without calling any service, for trying the dialog locally.
 * Only used when INVOICE_READER=demo is set explicitly.
 */
export const demoReader: InvoiceReader = {
  name: "demo",
  async read() {
    return normalizeScan({
      supplier: "Chapple & Jenkins", invoiceNumber: "DEMO-1001", date: new Date().toISOString().slice(0, 10), netTotal: 100,
      lines: [
        { description: "CHEDDAR MATURE COLOURED 5KG", code: "CH510", quantity: 2, unitPrice: 30, lineTotal: 60 },
        { description: "Double Cream 2L", code: "", quantity: 4, unitPrice: 7.5, lineTotal: 30 },
        { description: "TRUFFLE OIL 250ML", code: "TR250", quantity: 1, unitPrice: 10, lineTotal: 10 }
      ]
    });
  }
};

type Env = Record<string, string | undefined>;
type ReaderFactory = (env: Env) => InvoiceReader | null;

const READERS: Record<string, ReaderFactory> = {
  gemini: (env) => (env.GEMINI_API_KEY?.trim() ? geminiReader(env.GEMINI_API_KEY.trim(), env.GEMINI_MODEL?.trim() || "gemini-flash-latest") : null),
  demo: () => demoReader
};

/**
 * The reader chosen by INVOICE_READER (default "gemini"), or null when it is not configured.
 * Switching service later means adding a factory above and changing the variable on Vercel.
 */
export function getInvoiceReader(env: Env = process.env): InvoiceReader | null {
  const name = env.INVOICE_READER?.trim().toLowerCase() || "gemini";
  return READERS[name]?.(env) ?? null;
}
