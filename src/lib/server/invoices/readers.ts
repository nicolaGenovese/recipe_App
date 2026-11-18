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

/** Models tried in order when GEMINI_MODEL is not set: fast ones first, the moving alias last. */
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest"];

/**
 * Transcribing an invoice needs no long reasoning, and thinking models left at their default can
 * take over a minute, past Vercel's limit. Each family has its own switch; the alias gets none,
 * since it may point to either family.
 */
export function thinkingFor(model: string): Record<string, unknown> | undefined {
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-[3-9]/.test(model)) return { thinkingLevel: "low" };
  return undefined;
}

/** Vercel stops the function at 60 seconds: every attempt together must end before that. */
const TOTAL_MS = 52_000;

type Attempt = { ok: true; invoice: ScannedInvoice } | { ok: false; status: number; message: string; retry: boolean };

/** Google Gemini through its REST API; the free tier of Google AI Studio is enough for a few invoices a day. */
export function geminiReader(apiKey: string, models: string | string[]): InvoiceReader {
  const list = (Array.isArray(models) ? models : [models]).filter(Boolean);

  async function attempt(model: string, images: InvoiceImage[], hints: ReadHints, ms: number): Promise<Attempt> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const thinking = thinkingFor(model);
    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(ms),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: invoicePrompt(hints) }, ...images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.data } }))] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA, ...(thinking ? { thinkingConfig: thinking } : {}) }
        })
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      console.error("Gemini:", model, timedOut ? "timeout after " + ms + "ms" : error);
      return { ok: false, status: timedOut ? 504 : 502, message: timedOut ? "timeout" : "network " + String((error as { cause?: unknown })?.cause ?? error), retry: true };
    }
    const payload = await response.json().catch(() => ({})) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      error?: { code?: number; message?: string; status?: string };
    };
    if (!response.ok) {
      const message = payload.error?.message ?? "";
      console.error("Gemini:", model, response.status, message);
      const badKey = response.status === 403 || /api key|API_KEY/i.test(message);
      // Quota, a bad key and an unreadable request would fail the same way with another model.
      return { ok: false, status: response.status, message, retry: !badKey && response.status !== 429 && response.status !== 413 };
    }
    console.info("Gemini:", model, "answered in", Date.now() - started, "ms");
    const answer = payload.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
    try { return { ok: true, invoice: normalizeScan(JSON.parse(answer)) }; }
    catch {
      console.error("Gemini:", model, "unreadable answer", payload.candidates?.[0]?.finishReason, answer.slice(0, 200));
      return { ok: false, status: 422, message: "unreadable", retry: false };
    }
  }

  return {
    name: "gemini",
    async read(images, hints) {
      const deadline = Date.now() + TOTAL_MS;
      let last: Attempt | null = null;
      const tried: string[] = [];
      for (let index = 0; index < list.length; index++) {
        const left = deadline - Date.now();
        if (left < 5_000) break;
        // The first model gets most of the time; a fallback only runs when the first fails fast.
        const ms = index === list.length - 1 ? left : Math.min(left, 35_000);
        last = await attempt(list[index], images, hints, ms);
        if (last.ok) return last.invoice;
        tried.push(list[index] + " " + last.status + (last.message ? ": " + last.message.slice(0, 200) : ""));
        if (!last.retry) break;
      }
      const failure = last && !last.ok ? last : null;
      const detail = tried.join(" | ");
      if (failure?.status === 429) throw new HttpError(429, "Limite gratuito di letture raggiunto: riprova più tardi o inserisci le righe a mano.", detail);
      if (failure?.status === 403 || /api key|API_KEY/i.test(failure?.message ?? "")) throw new HttpError(502, "Il servizio di lettura ha rifiutato la richiesta: controlla la chiave GEMINI_API_KEY.", detail);
      if (failure?.status === 504) throw new HttpError(504, "La lettura sta impiegando troppo: riprova, oppure carica meno pagine o una foto più leggera.", detail);
      if (failure?.status === 422) throw new HttpError(502, "Non sono riuscito a leggere la fattura: prova con una foto più nitida.", detail);
      if (failure?.status === 400) throw new HttpError(502, "Il servizio di lettura non accetta questo file: prova con una foto JPG o un PDF diverso.", detail);
      throw new HttpError(502, "Il servizio di lettura non risponde: riprova tra poco.", detail);
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
  gemini: (env) => (env.GEMINI_API_KEY?.trim() ? geminiReader(env.GEMINI_API_KEY.trim(), env.GEMINI_MODEL?.trim() ? [env.GEMINI_MODEL.trim()] : GEMINI_MODELS) : null),
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
