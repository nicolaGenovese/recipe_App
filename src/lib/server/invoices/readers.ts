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
    "  kind = \"food\" for anything eaten or drunk (ingredients, drinks, coffee); \"cleaning\" for detergents, sanitisers,",
    "  degreasers, dishwasher and laundry products, cloths, scourers, gloves and blue roll; \"supplies\" for other non-food:",
    "  packaging, takeaway boxes, foil, cling film, baking paper, napkins, gas.",
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
          lineTotal: { type: "NUMBER", nullable: true },
          kind: { type: "STRING", enum: ["food", "cleaning", "supplies"] }
        },
        required: ["description", "quantity", "unitPrice"]
      }
    }
  },
  required: ["supplier", "invoiceNumber", "date", "lines"]
};

/** Tried after the models found for the key: aliases Google moves to its current Flash models. */
export const GEMINI_ALIASES = ["gemini-flash-latest", "gemini-flash-lite-latest"];

/**
 * Picks the models to try from Google's list for this key: the newest stable Flash, the next
 * one, the newest Flash-Lite (lighter, often free when Flash is busy), then the aliases. Google
 * retires models every few months, so no version is written in the code.
 */
export function pickModels(available: { name?: string; supportedGenerationMethods?: string[] }[]): string[] {
  const found = available
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => (model.name ?? "").replace(/^models\//, ""))
    .map((name) => ({ name, match: /^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/.exec(name) }))
    .filter((row): row is { name: string; match: RegExpExecArray } => row.match !== null)
    .sort((a, b) => Number(b.match[1]) - Number(a.match[1]));
  const flash = found.filter((row) => !row.match[2]).slice(0, 2).map((row) => row.name);
  const lite = found.filter((row) => row.match[2]).slice(0, 2).map((row) => row.name);
  return [...flash, ...lite, ...GEMINI_ALIASES].filter((name, index, list) => list.indexOf(name) === index).slice(0, 6);
}

/** Models whose free quota ran out recently: tried last until the time stored here. */
const resting = new Map<string, number>();
const REST_MS = 15 * 60_000;

/** Puts models that just ran out of quota at the end, keeping the order otherwise. */
export function byRest(models: string[], now = Date.now()): string[] {
  const tired = (model: string) => (resting.get(model) ?? 0) > now;
  return [...models.filter((model) => !tired(model)), ...models.filter(tired)];
}

let cachedModels: { key: string; models: string[]; until: number } | null = null;

/** Asks Google which models this key can use; kept for an hour. Falls back to the aliases. */
async function discoverModels(apiKey: string): Promise<string[]> {
  if (cachedModels && cachedModels.key === apiKey && cachedModels.until > Date.now()) return cachedModels.models;
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) { console.error("Gemini: model list", response.status); return GEMINI_ALIASES; }
    const payload = await response.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const models = pickModels(payload.models ?? []);
    cachedModels = { key: apiKey, models, until: Date.now() + 3_600_000 };
    return models;
  } catch (error) {
    console.error("Gemini: model list", error);
    return GEMINI_ALIASES;
  }
}

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
/** With no models given, the reader asks Google which ones the key can use. */
export function geminiReader(apiKey: string, models?: string | string[]): InvoiceReader {
  const fixed = (Array.isArray(models) ? models : models ? [models] : []).filter(Boolean);

  async function attempt(model: string, images: InvoiceImage[], hints: ReadHints, ms: number, withThinking = true): Promise<Attempt> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const thinking = withThinking ? thinkingFor(model) : undefined;
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
      // A model that does not take the thinking setting is asked again without it.
      if (thinking && response.status === 400 && /thinking/i.test(message)) return attempt(model, images, hints, Math.max(1_000, ms - (Date.now() - started)), false);
      const badKey = response.status === 403 || /api key|API_KEY/i.test(message);
      // Free quotas are per model, so a used-up quota moves on to the next one; a bad key or a
      // request too large would fail the same way everywhere.
      if (response.status === 429) resting.set(model, Date.now() + REST_MS);
      return { ok: false, status: response.status, message, retry: !badKey && response.status !== 413 };
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
      const list = byRest(fixed.length ? fixed : await discoverModels(apiKey));
      let last: Attempt | null = null;
      const tried: string[] = [];
      for (let index = 0; index < list.length; index++) {
        const left = deadline - Date.now();
        if (left < 5_000) break;
        // The first model gets most of the time; a fallback only runs when the first fails fast.
        const ms = index === list.length - 1 ? left : Math.min(left, 25_000);
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
      supplier: "Chapple & Jenkins", invoiceNumber: "DEMO-1001", date: new Date().toISOString().slice(0, 10), netTotal: 112,
      lines: [
        { description: "CHEDDAR MATURE COLOURED 5KG", code: "CH510", quantity: 2, unitPrice: 30, lineTotal: 60, kind: "food" },
        { description: "Double Cream 2L", code: "", quantity: 4, unitPrice: 7.5, lineTotal: 30, kind: "food" },
        { description: "TRUFFLE OIL 250ML", code: "TR250", quantity: 1, unitPrice: 10, lineTotal: 10, kind: "food" },
        { description: "HEAVY DUTY DEGREASER 5LTR", code: "DG5", quantity: 1, unitPrice: 12, lineTotal: 12, kind: "cleaning" }
      ]
    });
  }
};

type Env = Record<string, string | undefined>;
type ReaderFactory = (env: Env) => InvoiceReader | null;

const READERS: Record<string, ReaderFactory> = {
  gemini: (env) => (env.GEMINI_API_KEY?.trim() ? geminiReader(env.GEMINI_API_KEY.trim(), env.GEMINI_MODEL?.trim() || undefined) : null),
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
