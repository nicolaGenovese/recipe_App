import { INVOICE_MIME_TYPES, MAX_INVOICE_FILES, type InvoiceImage } from "@/lib/invoices/scan";

/** Longest side of a photo once resized: enough to read small print, small enough to send quickly. */
const MAX_SIDE = 1800;
/** Vercel refuses request bodies above about 4.5 MB, base64 included. */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

const readAsBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

async function shrinkPhoto(file: File): Promise<InvoiceImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("photo");
  return { mimeType: "image/jpeg", data: await readAsBase64(blob) };
}

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
      try { images.push(await shrinkPhoto(file)); }
      catch { throw new Error("Questa foto non si apre: prova a scattarla di nuovo o a caricare un JPG."); }
    } else throw new Error("Carica foto JPG, PNG o WEBP, oppure un PDF.");
  }
  if (images.some((image) => !INVOICE_MIME_TYPES.includes(image.mimeType))) throw new Error("Carica foto JPG, PNG o WEBP, oppure un PDF.");
  const bytes = images.reduce((total, image) => total + image.data.length, 0);
  if (bytes > MAX_TOTAL_BYTES) throw new Error("File troppo grandi: carica meno pagine o un PDF più leggero.");
  return images;
}
