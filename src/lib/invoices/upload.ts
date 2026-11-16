import { readAsBase64, shrinkImage } from "@/lib/images";
import { INVOICE_MIME_TYPES, MAX_INVOICE_FILES, type InvoiceImage } from "@/lib/invoices/scan";

/** Longest side of a photo once resized: enough to read small print, small enough to send quickly. */
const MAX_SIDE = 1800;
/** Vercel refuses request bodies above about 4.5 MB, base64 included. */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/**
 * Turns the picked photos or PDF into what the scan API takes. Photos are resized to JPEG; a PDF
 * goes as it is. Errors are Italian keys the dialog translates.
 */
export async function prepareInvoiceFiles(files: File[]): Promise<InvoiceImage[]> {
  if (!files.length) return [];
  if (files.length > MAX_INVOICE_FILES) throw new Error("Al massimo 5 pagine per fattura.");
  const images: InvoiceImage[] = [];
  for (const file of files) {
    if (file.type === "application/pdf") images.push({ mimeType: file.type, data: await readAsBase64(file) });
    else if (file.type.startsWith("image/")) {
      try { images.push(await shrinkImage(file, MAX_SIDE, 0.8)); }
      catch { throw new Error("Questa foto non si apre: prova a scattarla di nuovo o a caricare un JPG."); }
    } else throw new Error("Carica foto JPG, PNG o WEBP, oppure un PDF.");
  }
  if (images.some((image) => !INVOICE_MIME_TYPES.includes(image.mimeType))) throw new Error("Carica foto JPG, PNG o WEBP, oppure un PDF.");
  const bytes = images.reduce((total, image) => total + image.data.length, 0);
  if (bytes > MAX_TOTAL_BYTES) throw new Error("File troppo grandi: carica meno pagine o un PDF più leggero.");
  return images;
}
