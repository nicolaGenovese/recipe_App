import { requireContext } from "@/lib/server/auth/context";
import { INVOICE_MIME_TYPES, MAX_INVOICE_FILES, type InvoiceImage } from "@/lib/invoices/scan";
import { handle, json, readJson } from "@/lib/server/http";
import { getInvoiceReader } from "@/lib/server/invoices/readers";
import { HttpError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";
// Reading a multi-page invoice can take a while.
export const maxDuration = 60;

/** POST /api/invoices/scan reads invoice photos or a PDF and returns supplier, number, date, total and lines. */
export const POST = handle(async (request: Request) => {
  await requireContext(request, "stock.deliveries");
  const reader = getInvoiceReader();
  if (!reader) throw new HttpError(503, "Lettura fatture non configurata: aggiungi GEMINI_API_KEY nelle variabili d'ambiente.");
  const body = await readJson(request) as { files?: unknown; suppliers?: unknown };
  const files = Array.isArray(body.files) ? body.files : [];
  const images: InvoiceImage[] = files.flatMap((file) => {
    const row = (file && typeof file === "object" ? file : {}) as Record<string, unknown>;
    return typeof row.mimeType === "string" && INVOICE_MIME_TYPES.includes(row.mimeType) && typeof row.data === "string" && /^[A-Za-z0-9+/=]+$/.test(row.data)
      ? [{ mimeType: row.mimeType, data: row.data }] : [];
  });
  if (!images.length || images.length !== files.length) throw new HttpError(400, "Carica foto JPG, PNG o WEBP, oppure un PDF.");
  if (images.length > MAX_INVOICE_FILES) throw new HttpError(400, "Al massimo 5 pagine per fattura.");
  const suppliers = (Array.isArray(body.suppliers) ? body.suppliers : []).filter((name): name is string => typeof name === "string" && name.trim().length > 0 && name.length <= 80).slice(0, 100);
  return json(await reader.read(images, { suppliers }));
});
